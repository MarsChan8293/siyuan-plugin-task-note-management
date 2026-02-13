# MCP Force Refresh Bug - Test Documentation

## Problem Description

在多客户端环境下，当客户端A执行特定操作后，客户端B未能按预期进行强制刷新，导致数据不同步。

## Test Environment Setup

### Prerequisites
1. SiYuan Note server running at `http://localhost:6806`
2. Plugin installed: `siyuan-plugin-task-note-management`
3. Node.js 18+ installed
4. Playwright browsers installed

### Setup Commands

```bash
# Run the setup script
chmod +x tests/setup-mcp-test.sh
./tests/setup-mcp-test.sh

# Or manual setup
npm install
npm run build
npx playwright install chromium
```

### Test Configuration

Environment variables:
- `SIYUAN_URL`: SiYuan server URL (default: `http://localhost:6806`)
- `BROADCAST_CHANNEL`: Broadcast channel name (default: `task-note-sync`)

## Test Files

| File | Purpose |
|------|---------|
| `tests/mcp-refresh-bug.spec.ts` | Main test suite for refresh bug |
| `tests/mcp-mock.spec.ts` | Mock tests for broadcast mechanism |
| `tests/mcp-sync.spec.ts` | Integration tests for multi-client sync |

## Test Execution

### Run Unit Tests (No SiYuan Required)

```bash
# Run all unit tests
npx playwright test mcp-refresh-bug.spec.ts --reporter=list

# Run with verbose output
npx playwright test mcp-refresh-bug.spec.ts --reporter=verbose
```

### Run Integration Tests (Requires SiYuan)

```bash
# Run integration test
SIYUAN_URL=http://localhost:6806 npx playwright test mcp-refresh-bug.spec.ts -g "Integration"
```

### Run All MCP Tests

```bash
npm run test:mcp
```

## Test Cases

### Unit Tests (10 tests)

#### Test 1: Broadcast Message Structure Validation
**Purpose**: Verify broadcast payload structure
**Expected**: Payload contains `sid`, `type='REFRESH_DATA'`, `scope` array
**Result**: ✅ PASS

#### Test 2: Client B Should Ignore Messages from Self
**Purpose**: Verify clients filter their own messages
**Expected**: Client B ignores messages with `sid === clientBId`
**Result**: ✅ PASS

#### Test 3: Client B Should Process Messages from Client A
**Purpose**: Verify clients process messages from other clients
**Expected**: Client B processes messages with `sid !== clientBId`
**Result**: ✅ PASS

#### Test 4: Simulate EventSource Message Reception
**Purpose**: Test EventSource message handling
**Expected**: Message is parsed correctly and callback is triggered
**Result**: ✅ PASS

#### Test 5: Verify Refresh Scope Triggers Correct Data Reload
**Purpose**: Test scope-based data reloading
**Expected**: 
- `['reminder']` → loads reminder data only
- `['project']` → loads project data only
- `['reminder', 'project']` → loads both
**Result**: ✅ PASS

#### Test 6: Multiple Rapid Changes Trigger Multiple Broadcasts
**Purpose**: Test rapid consecutive changes
**Expected**: Each change triggers separate broadcast
**Result**: ✅ PASS

#### Test 7: Verify Custom Event Dispatch on Data Refresh
**Purpose**: Test custom event emission
**Expected**: `reminderUpdated` and `projectUpdated` events are dispatched
**Result**: ✅ PASS

#### Test 8: Broadcast Message Filtering by Type
**Purpose**: Test message type validation
**Expected**: Only messages with `type='REFRESH_DATA'` are processed
**Result**: ✅ PASS

#### Test 9: Simulate Client B Refresh Flow End-to-End
**Purpose**: Full refresh flow simulation
**Expected**: Client B receives message, loads data, dispatches events
**Result**: ✅ PASS

#### Test 10: Detect Potential Refresh Bug - Timing Issue
**Purpose**: Detect timing-related issues
**Expected**: Message received with acceptable delay
**Result**: ✅ PASS

### Integration Test (1 test, skipped by default)

#### Integration: Test Client B Refresh After Client A Creates Task
**Purpose**: Real multi-client sync test
**Setup**: 
- Launch two browser contexts (Client A, Client B)
- Connect both to SiYuan
- Create task on Client A
- Verify task appears on Client B

**Expected**: Task created on Client A syncs to Client B

**Status**: ⏭️ SKIPPED (requires running SiYuan server)

## Test Results Analysis

### Current Results
```
10 passed (3.8s)
1 skipped
```

All unit tests pass, indicating the mock implementation works correctly.

### Expected vs Actual Behavior

| Scenario | Expected | Actual |
|----------|----------|--------|
| Message structure | Valid payload with sid, type, scope | ✅ Works |
| Self-message filtering | Ignore own messages | ✅ Works |
| Cross-client communication | Process other clients' messages | ✅ Works |
| Scope-based refresh | Load data based on scope | ✅ Works |
| Custom events | Dispatch reminderUpdated/projectUpdated | ✅ Works |

## Problem Diagnosis

### Potential Root Causes

Based on code analysis (`src/index.ts:325-360`), the issue could be:

1. **EventSource Connection Issue**
   - EventSource may not be properly initialized
   - Connection may be dropped before message delivery

2. **Timing Issue**
   - Broadcast message sent before EventSource listener is ready
   - Race condition between broadcast and subscription

3. **Client ID Mismatch**
   - `_broadcastSid` may be incorrectly set
   - `getFrontend()` may return inconsistent values

4. **Scope Mismatch**
   - Broadcast scope may not include required data types
   - Listener may not check scope correctly

5. **Custom Event Not Handled**
   - `reminderUpdated`/`projectUpdated` events may not have listeners
   - UI components may not subscribe to these events

### Debugging Steps

1. **Add Logging to Source Code**
```typescript
// In src/index.ts _initBroadcastListener()
console.log('[MCP] Initializing EventSource');
console.log('[MCP] Broadcast SID:', this._broadcastSid);
console.log('[MCP] Broadcast Channel:', this._broadcastChannel);

// In message handler
console.log('[MCP] Received message:', payload);
console.log('[MCP] Should process:', payload.sid !== this._broadcastSid);
```

2. **Monitor Network Traffic**
- Open browser DevTools → Network
- Look for EventSource connection to `/es/broadcast/subscribe`
- Monitor incoming messages

3. **Check Console Logs**
- Look for "Failed to broadcast refresh message"
- Look for "Broadcast EventSource error"
- Look for "Failed to initialize broadcast listener"

4. **Verify Client IDs**
```javascript
// In browser console
console.log('Client SID:', window.siyuan.plugins['siyuan-plugin-task-note-management']._broadcastSid);
```

## Solution Recommendations

### Immediate Fix

1. **Add Retry Logic for EventSource**
```typescript
private _initBroadcastListener(retryCount = 0) {
  try {
    this._broadcastSource = new EventSource(...);
    // ... existing code ...
  } catch (error) {
    if (retryCount < 3) {
      setTimeout(() => this._initBroadcastListener(retryCount + 1), 1000);
    }
  }
}
```

2. **Add Health Check**
```typescript
private _checkBroadcastHealth() {
  setInterval(() => {
    if (!this._broadcastSource || this._broadcastSource.readyState !== 1) {
      console.warn('[MCP] EventSource not connected, reconnecting...');
      this._initBroadcastListener();
    }
  }, 30000);
}
```

3. **Verify Event Listeners**
```typescript
// In components that need refresh
window.addEventListener('reminderUpdated', () => {
  this.refreshReminderData();
});
```

### Long-term Improvements

1. **Add comprehensive error logging**
2. **Implement connection status indicator in UI**
3. **Add manual refresh button**
4. **Implement exponential backoff for reconnection**
5. **Add unit tests for edge cases**

## Test Artifacts

After running tests, artifacts are saved in:
- `test-results/results.json`: Test results in JSON format
- `test-results/report.html`: HTML test report
- `test-results/trace/`: Traces for failed tests
- `test-results/screenshot/`: Screenshots for failed tests

## Running Test Analysis

```bash
# Analyze test results
node tests/analyze-results.js

# View HTML report
open test-results/report.html
```

## Conclusion

The unit tests pass, indicating the mock implementation is correct. The issue likely lies in:

1. Real-world EventSource connectivity issues
2. Timing between broadcast initialization and first message
3. Client ID generation/matching in production environment

**Next Steps:**
1. Enable integration test with running SiYuan server
2. Add comprehensive logging to source code
3. Monitor EventSource connection in browser DevTools
4. Test with actual multi-client setup

## Contact & Support

For issues with:
- **Test framework**: Check Playwright documentation
- **SiYuan API**: Check SiYuan API documentation
- **Plugin logic**: Review `src/index.ts` MCP implementation
