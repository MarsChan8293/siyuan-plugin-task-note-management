import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

const SIYUAN_URL = 'http://localhost:6806';
const TEST_USERNAME = 'test';
const TEST_PASSWORD = 'test';

// 生成唯一的测试任务标题
function generateTestTaskTitle() {
  return `Test Task ${uuidv4().substring(0, 8)}`;
}

// 等待元素可见
async function waitForElement(page: any, selector: string, timeout: number = 30000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

// 等待元素包含文本
async function waitForText(page: any, selector: string, text: string, timeout: number = 30000) {
  await page.waitForFunction((selector, text) => {
    const element = document.querySelector(selector);
    return element && element.textContent?.includes(text);
  }, selector, text, { timeout });
}

test.describe('MCP Multi-Client Sync Test', () => {
  let browser: any;
  let pageA: any; // Client A
  let pageB: any; // Client B

  test.beforeAll(async ({ browser: br }) => {
    browser = br;
    // Create two browser contexts (simulating two different clients)
    const contextA = await browser.newContext({ storageState: 'playwright/.auth/state.json' });
    const contextB = await browser.newContext({ storageState: 'playwright/.auth/state.json' });
    pageA = await contextA.newPage();
    pageB = await contextB.newPage();
  });

  test.afterAll(async () => {
    await pageA.close();
    await pageB.close();
  });

  test('should sync task creation from Client A to Client B', async () => {
    test.skip('Requires Siyuan server running', true);
    
    // Step 1: Navigate both clients to Siyuan
    await pageA.goto(SIYUAN_URL);
    await pageB.goto(SIYUAN_URL);

    // Step 2: Wait for both pages to load
    await waitForElement(pageA, '.b3-app');
    await waitForElement(pageB, '.b3-app');

    // Step 3: Navigate to Task Note Management plugin
    await pageA.click('button:has-text("任务管理")');
    await pageB.click('button:has-text("任务管理")');

    await waitForElement(pageA, '.reminder-panel');
    await waitForElement(pageB, '.reminder-panel');

    // Step 4: Create a test project in Client A
    const projectName = `Test Project ${uuidv4().substring(0, 8)}`;
    await pageA.click('button:has-text("新建项目")');
    await pageA.fill('input[placeholder="项目名称"]', projectName);
    await pageA.click('button:has-text("确定")');

    await waitForText(pageA, '.project-item', projectName);

    // Step 5: Wait for project to sync to Client B
    await waitForText(pageB, '.project-item', projectName, 15000);

    // Step 6: Open project kanban in both clients
    await pageA.click(`.project-item:has-text("${projectName}")`);
    await pageB.click(`.project-item:has-text("${projectName}")`);

    await waitForElement(pageA, '.kanban-container');
    await waitForElement(pageB, '.kanban-container');

    // Step 7: Create a task in Client A
    const taskTitle = generateTestTaskTitle();
    await pageA.click('button:has-text("添加任务")');
    await pageA.fill('input[placeholder="任务标题"]', taskTitle);
    await pageA.click('button:has-text("保存")');

    await waitForText(pageA, '.kanban-card', taskTitle);

    // Step 8: Wait for task to sync to Client B
    await waitForText(pageB, '.kanban-card', taskTitle, 15000);

    // Step 9: Verify task appears in Client B
    const taskInClientB = await pageB.isVisible(`.kanban-card:has-text("${taskTitle}")`);
    expect(taskInClientB).toBe(true);

    // Step 10: Test task update sync
    const updatedTaskTitle = `${taskTitle} - Updated`;
    await pageA.click(`.kanban-card:has-text("${taskTitle}")`);
    await pageA.fill('input[placeholder="任务标题"]', updatedTaskTitle);
    await pageA.click('button:has-text("保存")');

    await waitForText(pageA, '.kanban-card', updatedTaskTitle);
    await waitForText(pageB, '.kanban-card', updatedTaskTitle, 15000);

    // Step 11: Test task deletion sync
    await pageA.click(`.kanban-card:has-text("${updatedTaskTitle}")`);
    await pageA.click('button:has-text("删除")');
    await pageA.click('button:has-text("确定")');

    // Wait for task to disappear in Client A
    await pageA.waitForFunction((title) => {
      return !document.querySelector(`.kanban-card:has-text("${title}")`);
    }, updatedTaskTitle);

    // Wait for task to disappear in Client B
    await pageB.waitForFunction((title) => {
      return !document.querySelector(`.kanban-card:has-text("${title}")`);
    }, updatedTaskTitle, { timeout: 15000 });
  });

  test('should sync project creation from Client A to Client B', async () => {
    test.skip('Requires Siyuan server running', true);
    
    // Step 1: Navigate both clients to task management
    await pageA.goto(`${SIYUAN_URL}/#tasks`);
    await pageB.goto(`${SIYUAN_URL}/#tasks`);

    await waitForElement(pageA, '.project-panel');
    await waitForElement(pageB, '.project-panel');

    // Step 2: Create project in Client A
    const projectName = `Sync Test Project ${uuidv4().substring(0, 8)}`;
    await pageA.click('button:has-text("新建项目")');
    await pageA.fill('input[placeholder="项目名称"]', projectName);
    await pageA.click('button:has-text("确定")');

    await waitForText(pageA, '.project-item', projectName);

    // Step 3: Wait for sync to Client B
    await waitForText(pageB, '.project-item', projectName, 15000);

    // Step 4: Verify project exists in Client B
    const projectInClientB = await pageB.isVisible(`.project-item:has-text("${projectName}")`);
    expect(projectInClientB).toBe(true);
  });

  test('should test refresh button functionality', async () => {
    test.skip('Requires Siyuan server running', true);
    
    // Step 1: Navigate to project kanban in both clients
    await pageA.goto(`${SIYUAN_URL}/#project-kanban`);
    await pageB.goto(`${SIYUAN_URL}/#project-kanban`);

    await waitForElement(pageA, '.kanban-container');
    await waitForElement(pageB, '.kanban-container');

    // Step 2: Create task in Client A
    const taskTitle = `Refresh Test ${uuidv4().substring(0, 8)}`;
    await pageA.click('button:has-text("添加任务")');
    await pageA.fill('input[placeholder="任务标题"]', taskTitle);
    await pageA.click('button:has-text("保存")');

    await waitForText(pageA, '.kanban-card', taskTitle);

    // Step 3: Click refresh button in Client B
    await pageB.click('button:has-title("刷新")');

    // Step 4: Verify task appears in Client B after refresh
    await waitForText(pageB, '.kanban-card', taskTitle, 10000);
    const taskExists = await pageB.isVisible(`.kanban-card:has-text("${taskTitle}")`);
    expect(taskExists).toBe(true);
  });
});