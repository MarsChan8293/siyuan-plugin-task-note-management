# Atomic Updates + Broadcast Sync Test Cases

## Environment
- URL: http://localhost:6806/stage/build/desktop/?r=3mhbuw7
- Auth code: siyuan123
- Broadcast channel: task-note-sync
- Expected refresh events: reminderUpdated, projectUpdated

## Pre-checks
1. App loads without console errors.
2. Plugin "Task Note Management" enabled.
3. Two client instances available:
   - Client A: normal window
   - Client B: another window, or another browser profile

## Reminder: Create
1. Client A: open Task Note Management panel.
2. Create a new reminder with title "Sync Test A".
3. Expected (A): reminder appears immediately; no errors.
4. Expected (B): within ~1s, reminder list refreshes and shows "Sync Test A".

## Reminder: Edit
1. Client A: edit "Sync Test A" title to "Sync Test A1".
2. Expected (A): updated title displayed.
3. Expected (B): updated title displayed within ~1s.

## Reminder: Delete
1. Client A: delete "Sync Test A1".
2. Expected (A): reminder removed.
3. Expected (B): reminder removed within ~1s.

## Reminder: Subtask Toggle
1. Client A: create a parent task with a subtask.
2. In Subtasks dialog, toggle subtask complete.
3. Expected (A): completed state updates, no duplicate entries.
4. Expected (B): completed state updates within ~1s.

## Project: Create
1. Client A: create a new project "Project Sync A".
2. Expected (A): project shows in list.
3. Expected (B): project shows in list within ~1s.

## Project: Edit + Status
1. Client A: change project priority and status.
2. Expected (A): updated in list.
3. Expected (B): updated within ~1s.

## Project: Delete (no tasks)
1. Client A: delete "Project Sync A" with no tasks.
2. Expected (A): project removed.
3. Expected (B): project removed within ~1s.

## Project: Delete (with tasks)
1. Client A: create project "Project Sync B".
2. Create two reminders assigned to this project.
3. Delete project and choose "delete tasks".
4. Expected (A): project and its tasks removed.
5. Expected (B): project and its tasks removed within ~1s.

## Project: Merge
1. Client A: create "Project Merge A" and "Project Merge B".
2. Create a reminder under "Project Merge A".
3. Merge A into B, delete source.
4. Expected (A): reminder now belongs to B, A removed.
5. Expected (B): same state within ~1s.

## Calendar: Copy Reminder
1. Client A: in Calendar view, copy a reminder to another date.
2. Expected (A): new reminder created.
3. Expected (B): new reminder appears within ~1s.

## Pomodoro: Count Increment
1. Client A: start and complete a pomodoro on a reminder.
2. Expected (A): pomodoroCount increments.
3. Expected (B): pomodoroCount updates within ~1s.

## ICS Subscription Merge (local reminders)
1. Client A: trigger any action that saves merged reminders (ICS subscription flow).
2. Expected (A): no data loss; local reminders preserved.
3. Expected (B): reminders refresh without errors.

## Offline / Broadcast Failure
1. Client A: temporarily block broadcast (stop server or disable network).
2. Create/edit a reminder.
3. Expected: local save succeeds; console logs broadcast failure; no UI crash.
4. Re-enable broadcast; create another reminder; sync resumes.

## Edge: Simultaneous Edit Window
1. Client A: open edit dialog for a reminder.
2. Client B: edit same reminder and save.
3. Client A: save afterwards.
4. Expected: last write wins; both clients refresh to last write state within ~1s.

## Edge: Concurrent Task Addition to Same Project
1. Client A: open a project.
2. Client B: open the same project.
3. Client A: create a new reminder "Task A" within this project.
4. Client B: create a new reminder "Task B" within this project at the same time.
5. Expected (A & B): Both "Task A" and "Task B" are successfully added and visible in the list on both clients within ~1s; no data loss.

## Person: Create
1. Client A: Open Task Note Management panel -> More -> Person Management.
2. Click "Add Person", enter "Test Person A".
3. Expected (A): "Test Person A" appears in the list.
4. Expected (B): Person list refreshes and shows "Test Person A".

## Person: Edit
1. Client A: Edit "Test Person A" to "Test Person A1".
2. Expected (A): Name updated.
3. Expected (B): Name updated within ~1s.

## Person: Delete
1. Client A: Delete "Test Person A1".
2. Expected (A): Person removed from list.
3. Expected (B): Person removed within ~1s.

## Reminder: Assign Person
1. Client A: Create person "Assignee A".
2. Create a reminder "Task with Assignee".
3. Click "Select Assignee" and choose "Assignee A".
4. Expected (A): Task saved with "Assignee A".
5. Expected (B): Task shows "Assignee A" as assignee within ~1s.
