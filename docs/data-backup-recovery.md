# 数据备份与恢复指南

## 自动备份机制

从插件版本 v0.3.6+ 开始，插件已集成自动数据备份功能，保护您的任务数据免受意外丢失。

### 备份策略

- **自动触发**：每次任务数据更新时自动创建备份
- **备份位置**：`siyuan/data/storage/petal/siyuan-plugin-task-note-management/`
- **备份文件命名**：`backup-reminder-{timestamp}.json`
  - 示例：`backup-reminder-1707820800000.json`
- **保留策略**：保留最近 10 份备份（自动清理旧备份）
- **备份内容**：完整的任务数据快照

### 自动审计日志

所有数据变更都会在浏览器控制台记录详细审计日志：

```javascript
[TASK-AUDIT] 任务数据变更: 50 → 48 (丢失 2)
[TASK-AUDIT] 备份已创建: backup-reminder-1707820800000.json, 任务数: 48
[TASK-AUDIT] saveReminders 增量更新: +2 ~10 -0
```

#### 日志级别

- **[INFO]** - 正常变更（任务丢失 <10%）
- **[WARNING]** - 警告级别（任务丢失 10%-50%）
- **[CRITICAL]** - 严重问题（任务丢失 >50%）

## 数据恢复操作

### 步骤 1：打开浏览器开发者工具

在 SiYuan 中按 `F12` 或右键 → 检查元素，打开开发者工具的 Console 面板。

### 步骤 2：查看可用备份

在控制台输入：

```javascript
// 查看备份文件信息
window.TaskPlugin.listBackups('reminder')
```

输出示例：
```
[TASK-AUDIT] 备份文件命名格式: backup-reminder-{timestamp}.json
[TASK-AUDIT] 请在 SiYuan 数据目录中查找备份文件：
[TASK-AUDIT]   路径: siyuan/data/storage/petal/siyuan-plugin-task-note-management/
```

### 步骤 3：查找备份文件

1. 打开 SiYuan 数据目录
2. 导航到 `data/storage/petal/siyuan-plugin-task-note-management/`
3. 查找形如 `backup-reminder-1707820800000.json` 的文件
4. 根据文件名中的时间戳选择要恢复的备份

**时间戳转换工具**：
```javascript
// 在控制台中将时间戳转换为可读日期
new Date(1707820800000).toLocaleString()
// 输出: "2024/2/13 下午8:00:00"
```

### 步骤 4：恢复备份

在控制台输入：

```javascript
// 恢复指定备份文件（替换为实际的备份文件名）
await window.TaskPlugin.restoreBackup('backup-reminder-1707820800000.json')
```

系统会弹出确认对话框，显示：
- 备份文件名
- 任务数量
- 警告：当前数据将被覆盖

确认后：
1. 自动创建当前数据的紧急备份（`backup-reminder-before-restore-{timestamp}.json`）
2. 恢复选定的备份数据
3. 刷新界面显示恢复的数据

### 步骤 5：验证恢复结果

检查任务面板，确认数据已正确恢复。

## 预防数据丢失

### 架构改进（v0.3.6+）

1. **智能增量更新**：`saveReminders` 改用增量更新而非全量替换，减少竞态条件
2. **严格损坏检测**：只在数据真正损坏时触发保护，不再误删数据
3. **ICS 导入安全**：修复了 ICS 导入绕过写队列的问题
4. **数据变更审计**：详细记录每次数据变更，便于追踪问题

### 监控数据健康

定期检查控制台日志（过滤 `[TASK-AUDIT]`）：
- 关注 `[CRITICAL]` 级别的告警
- 检查 `lostKeys` 字段了解丢失的任务 ID
- 根据 `stack` 调用栈定位问题来源

## 常见问题

### Q1: 如何手动触发备份？

备份是自动的，每次数据更新时触发。如需手动备份：
```javascript
// 创建一个临时任务然后删除，会触发备份
await window.TaskPlugin.addReminder({id: 'temp-backup-trigger', title: 'Backup'})
await window.TaskPlugin.deleteReminder('temp-backup-trigger')
```

### Q2: 备份文件占用空间太大怎么办？

备份文件会自动清理，只保留最近 10 份。如需手动清理：
1. 导航到备份目录
2. 删除旧的 `backup-reminder-*.json` 文件（保留最近几个）

### Q3: 恢复备份后发现数据还不对？

1. 检查 `backup-reminder-before-restore-*.json` 文件（恢复前的紧急备份）
2. 尝试恢复更早的备份文件
3. 如果所有备份都有问题，联系开发者并提供控制台日志

### Q4: 控制台显示 "window.TaskPlugin is undefined"？

插件可能未加载或加载失败：
1. 检查插件是否已启用：设置 → 插件 → 任务笔记管理
2. 禁用后重新启用插件
3. 刷新页面（F5）
4. 查看控制台是否有插件加载错误

## 应急恢复流程

如果发现任务数据丢失：

1. **立即停止操作** - 避免进一步覆盖数据
2. **查看审计日志** - 在控制台过滤 `[TASK-AUDIT]` 查找 `[CRITICAL]` 告警
3. **找到最近的备份** - 检查备份目录的文件时间戳
4. **恢复备份** - 使用 `window.TaskPlugin.restoreBackup()` 方法
5. **报告问题** - 将控制台日志截图发送到 GitHub Issues

## 技术细节

### 备份触发时机

- `_atomicUpdate` 方法执行时（所有数据更新操作的底层入口）
- 仅当数据修改前任务数 > 0 时触发
- 备份创建在 `mutate` 执行前完成

### 文件格式

备份文件是标准 JSON 格式，与 `reminder.json` 完全兼容：
```json
{
  "task-id-1": { "title": "...", "dueDate": "...", ... },
  "task-id-2": { "title": "...", "dueDate": "...", ... }
}
```

### 恢复安全性

- 恢复前自动创建当前数据的紧急备份
- 使用 `saveReminderData` 方法，经过写队列保证原子性
- 支持撤销：恢复失败时可回退到紧急备份

---

**版本要求**：此功能需要插件版本 >= v0.3.6

**相关文档**：
- [AGENTS.md](../AGENTS.md) - 插件开发指南
- [TEST-REPORT.md](../TEST-REPORT.md) - 测试报告
