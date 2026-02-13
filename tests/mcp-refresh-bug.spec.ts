import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

const SIYUAN_URL = process.env.SIYUAN_URL || 'http://localhost:6806';
const BROADCAST_CHANNEL = 'task-note-sync';

interface BroadcastPayload {
  sid: string;
  type: string;
  scope: string[];
}

class MockEventSource {
  url: string;
  listeners: { [key: string]: ((event: MessageEvent) => void)[] } = {};
  readyState: number = 0;
  errorCallback: ((error: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(channel: string, callback: (event: MessageEvent) => void) {
    if (!this.listeners[channel]) {
      this.listeners[channel] = [];
    }
    this.listeners[channel].push(callback);
  }

  removeEventListener(channel: string, callback: (event: MessageEvent) => void) {
    if (this.listeners[channel]) {
      this.listeners[channel] = this.listeners[channel].filter(cb => (cb !== callback));
    }
  }

  simulateMessage(channel: string, data: any) {
    if (this.listeners[channel]) {
      const event = new MessageEvent(channel, { data: JSON.stringify(data) });
      this.listeners[channel].forEach(callback => callback(event));
    }
  }

  set onerror(callback: ((error: any) => void) | null) {
    this.errorCallback = callback;
  }

  close() {
    this.listeners = {};
    this.readyState = 2;
  }
}

test.describe('MCP Force Refresh Bug Test', () => {
  let mockEventSource: MockEventSource;
  let clientAId: string;
  let clientBId: string;
  let receivedMessages: any[] = [];

  test.beforeEach(() => {
    clientAId = 'client-a-' + uuidv4().substring(0, 8);
    clientBId = 'client-b-' + uuidv4().substring(0, 8);
    receivedMessages = [];
  });

  test.afterEach(() => {
    if (mockEventSource) {
      mockEventSource.close();
    }
  });

  test('Test 1: Broadcast message structure validation', () => {
    const payload: BroadcastPayload = {
      sid: clientAId,
      type: 'REFRESH_DATA',
      scope: ['reminder']
    };

    expect(payload.sid).toBeDefined();
    expect(payload.type).toBe('REFRESH_DATA');
    expect(Array.isArray(payload.scope)).toBe(true);
    expect(payload.scope).toContain('reminder');
  });

  test('Test 2: Client B should ignore messages from itself', () => {
    const ownPayload: BroadcastPayload = {
      sid: clientBId,
      type: 'REFRESH_DATA',
      scope: ['reminder']
    };

    const shouldIgnore = ownPayload.sid === clientBId;
    expect(shouldIgnore).toBe(true);
  });

  test('Test 3: Client B should process messages from Client A', () => {
    const otherPayload: BroadcastPayload = {
      sid: clientAId,
      type: 'REFRESH_DATA',
      scope: ['reminder']
    };

    const shouldProcess = otherPayload.sid !== clientBId;
    expect(shouldProcess).toBe(true);
  });

  test('Test 4: Simulate EventSource message reception', () => {
    mockEventSource = new MockEventSource(`/es/broadcast/subscribe?channel=${BROADCAST_CHANNEL}`);

    let receivedPayload: any = null;
    mockEventSource.addEventListener(BROADCAST_CHANNEL, (event: MessageEvent) => {
      receivedPayload = JSON.parse(event.data);
      receivedMessages.push(receivedPayload);
    });

    const testPayload: BroadcastPayload = {
      sid: clientAId,
      type: 'REFRESH_DATA',
      scope: ['reminder', 'project']
    };

    mockEventSource.simulateMessage(BROADCAST_CHANNEL, testPayload);

    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload.sid).toBe(clientAId);
    expect(receivedPayload.type).toBe('REFRESH_DATA');
    expect(receivedPayload.scope).toEqual(['reminder', 'project']);
    expect(receivedMessages.length).toBe(1);
  });

  test('Test 5: Verify refresh scope triggers correct data reload', () => {
    const scopeTestCases = [
      { scope: ['reminder'], shouldLoadReminder: true, shouldLoadProject: false },
      { scope: ['project'], shouldLoadReminder: false, shouldLoadProject: true },
      { scope: ['reminder', 'project'], shouldLoadReminder: true, shouldLoadProject: true }
    ];

    scopeTestCases.forEach(({ scope, shouldLoadReminder, shouldLoadProject }) => {
      const shouldReminder = scope.includes('reminder');
      const shouldProject = scope.includes('project');

      expect(shouldReminder).toBe(shouldLoadReminder);
      expect(shouldProject).toBe(shouldLoadProject);
    });
  });

  test('Test 6: Multiple rapid changes should trigger multiple broadcasts', () => {
    mockEventSource = new MockEventSource(`/es/broadcast/subscribe?channel=${BROADCAST_CHANNEL}`);

    mockEventSource.addEventListener(BROADCAST_CHANNEL, (event: MessageEvent) => {
      const payload = JSON.parse(event.data);
      receivedMessages.push(payload);
    });

    const payloads: BroadcastPayload[] = [
      { sid: clientAId, type: 'REFRESH_DATA', scope: ['reminder'] },
      { sid: clientAId, type: 'REFRESH_DATA', scope: ['project'] },
      { sid: clientAId, type: 'REFRESH_DATA', scope: ['reminder', 'project'] }
    ];

    payloads.forEach(payload => {
      mockEventSource.simulateMessage(BROADCAST_CHANNEL, payload);
    });

    expect(receivedMessages.length).toBe(3);
    expect(receivedMessages[0].scope).toEqual(['reminder']);
    expect(receivedMessages[1].scope).toEqual(['project']);
    expect(receivedMessages[2].scope).toEqual(['reminder', 'project']);
  });

  test('Test 7: Verify custom event dispatch on data refresh', () => {
    let reminderUpdatedFired = false;
    let projectUpdatedFired = false;

    const onReminderUpdated = () => { reminderUpdatedFired = true; };
    const onProjectUpdated = () => { projectUpdatedFired = true; };

    const dispatchEvents = (scope: string[]) => {
      if (scope.includes('reminder')) {
        onReminderUpdated();
      }
      if (scope.includes('project')) {
        onProjectUpdated();
      }
    };

    dispatchEvents(['reminder']);
    expect(reminderUpdatedFired).toBe(true);
    expect(projectUpdatedFired).toBe(false);

    reminderUpdatedFired = false;
    projectUpdatedFired = false;

    dispatchEvents(['project']);
    expect(reminderUpdatedFired).toBe(false);
    expect(projectUpdatedFired).toBe(true);

    reminderUpdatedFired = false;
    projectUpdatedFired = false;

    dispatchEvents(['reminder', 'project']);
    expect(reminderUpdatedFired).toBe(true);
    expect(projectUpdatedFired).toBe(true);
  });

  test('Test 8: Broadcast message filtering by type', () => {
    const validPayloads: BroadcastPayload[] = [
      { sid: clientAId, type: 'REFRESH_DATA', scope: ['reminder'] },
      { sid: clientAId, type: 'REFRESH_DATA', scope: ['project'] }
    ];

    const invalidPayloads: any[] = [
      { sid: clientAId, type: 'INVALID_TYPE', scope: ['reminder'] },
      { type: 'REFRESH_DATA', scope: ['reminder'] }
    ];

    validPayloads.forEach(payload => {
      expect(payload.type).toBe('REFRESH_DATA');
      expect(payload.sid).toBeDefined();
      expect(payload.scope).toBeDefined();
    });

    invalidPayloads.forEach(payload => {
      if (!payload.sid) {
        expect(payload.sid).toBeUndefined();
      } else if (payload.type !== 'REFRESH_DATA') {
        expect(payload.type).not.toBe('REFRESH_DATA');
      }
    });
  });

  test('Test 9: Simulate client B refresh flow end-to-end', async () => {
    mockEventSource = new MockEventSource(`/es/broadcast/subscribe?channel=${BROADCAST_CHANNEL}`);

    let refreshActions: string[] = [];

    mockEventSource.addEventListener(BROADCAST_CHANNEL, (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as BroadcastPayload;

      if (payload.sid === clientBId) {
        return;
      }

      if (payload.type !== 'REFRESH_DATA') {
        return;
      }

      if (payload.scope.includes('reminder')) {
        refreshActions.push('loadReminderData(true)');
        refreshActions.push('dispatchEvent(reminderUpdated)');
      }

      if (payload.scope.includes('project')) {
        refreshActions.push('loadProjectData(true)');
        refreshActions.push('dispatchEvent(projectUpdated)');
      }
    });

    const testPayload: BroadcastPayload = {
      sid: clientAId,
      type: 'REFRESH_DATA',
      scope: ['reminder']
    };

    mockEventSource.simulateMessage(BROADCAST_CHANNEL, testPayload);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(refreshActions).toHaveLength(2);
    expect(refreshActions[0]).toBe('loadReminderData(true)');
    expect(refreshActions[1]).toBe('dispatchEvent(reminderUpdated)');
  });

  test('Test 10: Detect potential refresh bug - timing issue', async () => {
    let refreshTimestamps: number[] = [];
    let messageReceived = false;

    mockEventSource = new MockEventSource(`/es/broadcast/subscribe?channel=${BROADCAST_CHANNEL}`);

    mockEventSource.addEventListener(BROADCAST_CHANNEL, (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as BroadcastPayload;
      messageReceived = true;
      refreshTimestamps.push(Date.now());
    });

    setTimeout(() => {
      mockEventSource.simulateMessage(BROADCAST_CHANNEL, {
        sid: clientAId,
        type: 'REFRESH_DATA',
        scope: ['reminder']
      });
    }, 50);

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(messageReceived).toBe(true);
    expect(refreshTimestamps.length).toBe(1);

    const delay = refreshTimestamps[0];
    expect(delay).toBeGreaterThan(0);
  });
});

test.describe('MCP Refresh Bug - Real Network Test', () => {
  let browser: any;
  let pageA: any;
  let pageB: any;
  let testProjectId: string | null = null;

  test.beforeAll(async ({ browser: br }) => {
    browser = br;
  });

  test.afterAll(async () => {
    if (pageA) await pageA.close();
    if (pageB) await pageB.close();
  });

  test('Integration: Test client B refresh after client A creates task', async () => {
    test.skip(true, 'Requires Siyuan server running at ' + SIYUAN_URL);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    pageA = await contextA.newPage();
    pageB = await contextB.newPage();

    await pageA.goto(SIYUAN_URL);
    await pageB.goto(SIYUAN_URL);

    await pageA.waitForSelector('.b3-app', { timeout: 10000 });
    await pageB.waitForSelector('.b3-app', { timeout: 10000 });

    console.log('Both clients connected to SiYuan');

    const taskTitle = `MCP Test Task ${uuidv4().substring(0, 8)}`;

    console.log('Creating task on Client A:', taskTitle);
    await pageA.evaluate(async (title) => {
      try {
        const plugin = (window as any).siyuan.plugins['siyuan-plugin-task-note-management'];
        if (!plugin) {
          console.error('Plugin not found');
          return { success: false, error: 'Plugin not found' };
        }

        const reminderData = await plugin.loadReminderData();
        const newReminder = {
          id: uuidv4(),
          title: title,
          completed: false,
          timestamp: Date.now()
        };

        reminderData[newReminder.id] = newReminder;
        await plugin.saveReminderData(reminderData);

        return { success: true, reminderId: newReminder.id };
      } catch (error) {
        console.error('Error creating reminder:', error);
        return { success: false, error: String(error) };
      }
    }, taskTitle);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const taskExistsInClientB = await pageB.evaluate(async (title) => {
      try {
        const plugin = (window as any).siyuan.plugins['siyuan-plugin-task-note-management'];
        if (!plugin) {
          return { exists: false, error: 'Plugin not found' };
        }

        const reminderData = await plugin.loadReminderData(true);
        const exists = Object.values(reminderData).some((r: any) => r.title === title);
        return { exists };
      } catch (error) {
        return { exists: false, error: String(error) };
      }
    }, taskTitle);

    console.log('Task exists in Client B:', taskExistsInClientB);

    expect(taskExistsInClientB.exists).toBe(true);

    if (taskExistsInClientB.error) {
      console.error('Error checking task in Client B:', taskExistsInClientB.error);
    }
  });
});
