# AGENTS.md - SiYuan Task Note Management Plugin

## Build Commands

- `npm run dev` - Development build with hot reload and inline sourcemaps (auto-copies to SiYuan)
- `npm run build` - Production build (outputs to `dist/` and creates `package.zip`)
- `npm run make-link` - Create symbolic link to SiYuan plugins directory (Linux/macOS)
- `npm run make-link-win` - Create symbolic link to SiYuan plugins directory (Windows)
- `npm run make-install` - Build and install plugin to SiYuan
- `npm run update-version` - Update plugin version

## Testing

**No automated test framework exists.** Test changes manually:
1. Run `npm run dev` to build with hot reload
2. Copy `dev/` directory to SiYuan plugins directory: `/siyuan/workspace/data/plugins/siyuan-plugin-task-note-management/`
3. Refresh plugin in SiYuan: Settings → Plugins → Disable → Enable
4. Test in SiYuan Notes application
5. Verify bilingual support (English/Chinese)
6. Check data persistence across reloads

## Docker Deployment

When using Docker environment, the plugin files should be copied to the container:

```bash
# Build the plugin
NODE_ENV=development npx vite build

# Copy to SiYuan container (adjust container name as needed)
docker exec siyuan rm -rf /siyuan/workspace/data/plugins/siyuan-plugin-task-note-management/*
docker cp dev/. siyuan:/siyuan/workspace/data/plugins/siyuan-plugin-task-note-management/

# Verify files were copied
docker exec siyuan ls -la /siyuan/workspace/data/plugins/siyuan-plugin-task-note-management/
```

## Code Style Guidelines

### File Headers
Always include copyright headers in TS/Svelte files:
```typescript
/*
 * Copyright (c) 2024 by [author]. All Rights Reserved.
 * @Author       : [author]
 * @Date         : [date]
 * @FilePath     : /path/to/file
 * @LastEditTime : [date]
 * @Description  : [description]
 */
```

### TypeScript Conventions

**Naming:**
- Classes: PascalCase (`ReminderDialog`, `ProjectPanel`)
- Functions/methods: camelCase (`loadSettings`, `createDocWithMd`)
- Constants: UPPER_SNAKE_CASE (`STORAGE_NAME`, `TAB_TYPE`)
- Private members: `_underscore` prefix or private modifier

**Imports:**
- Use `@/` alias for src imports: `import { i18n } from '@/pluginInstance'`
- Group imports: siyuan API, internal imports, then third-party
- Absolute imports preferred over relative

**Formatting:**
- 2-space indentation (check existing code)
- No comments unless necessary
- Prefer `const` over `let`
- Use async/await for async operations
- Descriptive variable names (Chinese comments allowed)

**Types:**
- Always use TypeScript types (avoid `any`)
- Define interfaces in `src/types/`
- Leverage SiYuan API types from `siyuan` package
- Use strict mode not enabled, but `noUnusedLocals` and `noUnusedParameters` are

**Error Handling:**
- Always try-catch async operations
- Use `showMessage()` from `siyuan` for user feedback
- Log detailed errors to console
- Show user-friendly messages via `i18n()` translations

### Svelte Conventions

- Use `<script lang="ts">` for TypeScript support
- Reactive declarations with `$:` for computed values
- Proper lifecycle: `onMount`, `onDestroy`
- Keep components focused and single-responsibility
- Props: `export let variableName`
- Events: `createEventDispatcher()`

### Internationalization (Critical)

**Always support both English and Chinese:**
1. Use `i18n()` function from `src/pluginInstance.ts` for all UI strings
2. Add translations to `i18n/en_US.json` and `i18n/zh_CN.json`
3. Translation keys: descriptive camelCase
4. Example: `showMessage(i18n("taskCreatedSuccessfully"))`

### SiYuan API Integration

**Common operations (from `src/api.ts`):**
- `createDocWithMd()` - Create documents with Markdown
- `getBlock()` - Get block by ID
- `updateBlock()` - Update block content
- `setBlockAttrs()` - Set block attributes
- `pushMsg()` - Show success message
- `pushErrMsg()` - Show error message

**Block references:**
- Block IDs: 22-character strings
- Block reference format: `((blockId "title"))`
- SiYuan link format: `siyuan://blocks/blockId`
- Document operations use notebook IDs + paths

### Data Management

**Storage files:**
- `reminder-settings.json` - Plugin settings
- `reminder.json` - Reminder data
- `project.json` - Project data
- `categories.json` - Categories
- `persons.json` - Persons (assignees)
- `habit.json` - Habits
- `pomodoro_record.json` - Pomodoro stats
- Use `plugin.loadData(STORAGE_NAME)` and `plugin.saveData(data, STORAGE_NAME)`

**Date/Time:**
- Format: `YYYY-MM-DD HH:mm` (local time)
- Use `chrono-node` for natural language parsing ("tomorrow at 3pm")
- Helpers in `src/utils/dateUtils.ts`: `getLocalDateString()`, `getLocalTimeString()`, `compareDateStrings()`

## Project Structure

```
src/
├── index.ts              # Main plugin entry (ReminderPlugin class)
├── api.ts                # SiYuan API wrappers
├── pluginInstance.ts     # Global plugin instance & i18n
├── components/           # Dialogs, panels, views
├── utils/                # Business logic managers
├── libs/                 # Utilities and form components
├── types/                # TypeScript definitions
├── SettingPanel.svelte   # Settings UI
└── index.scss            # Global styles
```

## Best Practices

1. **Bilingual Support**: Always add English and Chinese translations
2. **Data Integrity**: Preserve user data, no breaking changes
3. **Bullet Journal Philosophy**: Task-centered note-taking approach
4. **Mobile Compatible**: Plugin supports iOS/Android
5. **SiYuan Compatibility**: Minimum v3.0.12+
6. **Type Safety**: Use types, avoid `any`
7. **Error Handling**: Graceful failures with user feedback
8. **Test in SiYuan**: Always test in actual SiYuan environment

## Common Patterns

**Showing messages:**
```typescript
import { showMessage } from "siyuan";
import { i18n } from "./pluginInstance";
showMessage(i18n("operationSuccessful"));
showMessage(i18n("operationFailed"), 5000, "error");
```

**Block operations:**
```typescript
import { getBlock, setBlockAttrs } from "./api";
const block = await getBlock(blockId);
await setBlockAttrs(blockId, {
  "custom-reminder-time": "2024-12-25 10:00"
});
```

**Creating tab views:**
```typescript
this.addTab({
  type: TAB_TYPE,
  init() { this.element.innerHTML = '<div id="content"></div>'; },
  beforeDestroy() { /* cleanup */ },
  destroy() { /* final cleanup */ }
});
```

## Technology Stack

- TypeScript 5.1+
- Svelte 4.2
- Vite 5.2 (build tool)
- SiYuan Plugin API 1.1.7
- chrono-node (date parsing)
- ECharts (charts)
- SASS (styles)

## Person/Assignee Management Feature

### Overview
The plugin now includes a complete person/assignee management system for assigning responsibilities to tasks and projects.

### Implementation

**Core Components:**
- `src/types/person.ts` - Person type definition
- `src/utils/personManager.ts` - PersonManager class (singleton pattern)
- `src/components/PersonManageDialog.ts` - Person management UI
- `src/components/PersonSelectDialog.ts` - Person selection UI

**Integration Points:**
- `src/components/QuickReminderDialog.ts` - Task creation/editing with assignee selection
- `src/components/ReminderPanel.ts` - "更多" menu with "责任人管理" entry
- `src/index.ts` - persons.json storage support and caching
- `src/types/reminder.ts` - ReminderItem.assigneeId field
- `src/utils/projectManager.ts` - Project.assigneeId field

### Data Structure

**persons.json:**
```json
[
  {
    "id": "person_1234567890_abc",
    "name": "张三",
    "createdAt": "2024-02-01T12:00:00.000Z"
  }
]
```

**Task with assignee:**
```json
{
  "id": "reminder_id",
  "title": "完成项目文档",
  "assigneeId": "person_1234567890_abc",
  // ... other fields
}
```

**Project with assignee:**
```json
{
  "id": "project_id",
  "name": "网站重构",
  "assigneeId": "person_1234567890_abc",
  // ... other fields
}
```

### Usage

**Managing Persons:**
1. Open Reminder Panel in SiYuan
2. Click "更多" (More) button
3. Select "责任人管理" (Person Management)
4. Add/Edit/Delete persons

**Assigning Persons to Tasks:**
1. Create or edit a task
2. Click "选择责任人" (Select Assignee) button
3. Select a person or choose "无责任人" (No Assignee)
4. Save the task

### API

**PersonManager Methods:**
- `getInstance(plugin)` - Get singleton instance
- `initialize()` - Initialize and load data
- `getPersons()` - Get all persons
- `getPersonById(id)` - Get person by ID
- `getPersonName(id)` - Get person name by ID
- `addPerson(name)` - Add new person
- `updatePerson(id, updates)` - Update person
- `deletePerson(id)` - Delete person
- `checkPersonInUse(personId)` - Check if person is assigned to tasks/projects

### Translations

Added keys to `i18n/en_US.json` and `i18n/zh_CN.json`:
- `personManagement` - Person Management / 责任人管理
- `addPerson` - Add Person / 添加责任人
- `editPerson` - Edit Person / 编辑责任人
- `deletePerson` - Delete Person / 删除责任人
- `personName` - Person Name / 责任人姓名
- `assignee` - Assignee / 责任人
- `selectAssignee` - Select Assignee / 选择责任人
- `noAssignee` - No Assignee / 无责任人
- `personCreatedSuccessfully` - Person created successfully / 责任人创建成功
- `personUpdatedSuccessfully` - Person updated successfully / 贴任人更新成功
- `personDeletedSuccessfully` - Person deleted successfully / 责任人删除成功
- `personNameRequired` - Person name is required / 责任人姓名不能为空
- `confirmDeletePerson` - Are you sure you want to delete this person? / 确定要删除此责任人吗？
- `personInUseWarning` - This person is assigned to {0} task(s) and {1} project(s). Please unassign them first. / 该责任人已被分配给{0}个任务和{1}个项目，请先解除分配。

### Future Enhancements

- Display assignee name in ReminderPanel task cards
- Display assignee name in ProjectKanbanView task cards
- Display assignee name in ProjectPanel project cards
- Add assignee selection to ProjectDialog
- Add search/filter functionality to PersonManageDialog
