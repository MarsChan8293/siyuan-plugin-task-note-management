# AGENTS.md - Siyuan Task Note Management Plugin

## Build Commands

- `npm run dev` - Development build with hot reload and inline sourcemaps (auto-copies to SiYuan)
- `npm run build` - Production build (outputs to `dist/` and creates `package.zip`)
- `npm run make-link` - Create symbolic link to SiYuan plugins directory (Linux/macOS)
- `npm run make-link-win` - Create symbolic link to SiYuan plugins directory (via PowerShell elevation)
- `npm run make-install` - Build and install plugin to SiYuan
- `npm run update-version` - Update plugin version

## Testing

**NO automated tests exist.** Test changes manually:
1. Run `npm run dev` to build with hot reload
2. Copy `dev/` directory to SiYuan plugins directory: `/siyuan/workspace/data/plugins/siyuan-plugin-task-note-management/`
3. Refresh plugin in SiYuan: Settings → Plugins → Disable → Enable
4. Test in SiYuan Notes application
5. Verify bilingual support (English/Chinese)
6. Check data persistence across reloads

## Docker Deployment

```bash
# Build the plugin
NODE_ENV=development npx vite build

# Copy to SiYuan container (adjust container name as needed)
docker exec siyuan rm -rf /siyuan/workspace/data/plugins/siyuan-plugin-task-note-management/*
docker cp dev/. siyuan:/siyuan/workspace/data/plugins/siyuan-plugin-task-note-management/
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
**Naming:** Classes: PascalCase, Functions: camelCase, Constants: UPPER_SNAKE_CASE, Private: `_prefix`

**Imports:** Use `@/` alias for src imports, group: siyuan API → internal → third-party

**Formatting:** 2-space indentation, prefer `const`, async/await, descriptive names (Chinese comments allowed)

**Types:** Always use TypeScript (avoid `any`), define interfaces in `src/types/`, use SiYuan API types

**Error Handling:** Try-catch async operations, `showMessage()` for user feedback, log errors, use `i18n()` translations

### Svelte Conventions
- `<script lang="ts">` for TypeScript support
- Reactive declarations: `$:`
- Lifecycle: `onMount`, `onDestroy`
- Props: `export let variableName`
- Events: `createEventDispatcher()`

### Internationalization (Critical)
1. Use `i18n()` from `src/pluginInstance.ts` for all UI strings
2. Add translations to `i18n/en_US.json` and `i18n/zh_CN.json`
3. Translation keys: descriptive camelCase
4. Example: `showMessage(i18n("taskCreatedSuccessfully"))`

### SiYuan API Integration
**Common operations (from `src/api.ts`):**
- `createDocWithMd()` - Create documents with Markdown
- `getBlock()` - Get block by ID
- `updateBlock()` - Update block content
- `setBlockAttrs()` - Set block attributes
- `pushMsg()` / `pushErrMsg()` - Show messages

**Block references:**
- Block IDs: 22-character strings
- Block reference format: `((blockId "title"))`
- SiYuan link format: `siyuan://blocks/blockId`
- Document operations use notebook IDs + paths

### Data Management
**Storage files:** `reminder-settings.json`, `reminder.json`, `project.json`, `categories.json`, `persons.json`, `habit.json`, `pomodoro_record.json`

Use `plugin.loadData(STORAGE_NAME)` and `plugin.saveData(data, STORAGE_NAME)`

**Date/Time:** Format: `YYYY-MM-DD HH:mm`, use `chrono-node` for natural language parsing

**Helpers in `src/utils/dateUtils.ts`:** `getLocalDateString()`, `getLocalTimeString()`, `compareDateStrings()`

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
