# Keyboard Shortcuts System

This directory contains the keyboard shortcuts system for Sentry's React application.

## Testing the MVP

### 1. Start the application

Make sure the Sentry application is running locally.

### 2. Test the Help Modal

- Press `shift + /` (the `?` key) anywhere in the app to open the keyboard shortcuts help modal
- The modal should display all available shortcuts organized by category
- Try searching for shortcuts using the search input

### 3. Test Navigation Shortcuts

Try these navigation shortcuts (press `g` followed by the second key):

- `g` then `i` - Navigate to Issues
- `g` then `f` - Navigate to Feedback
- `g` then `p` - Navigate to Projects
- `g` then `d` - Navigate to Dashboards
- `g` then `t` - Navigate to Traces
- `g` then `v` - Navigate to Discover
- `g` then `l` - Navigate to Logs
- `g` then `Shift+P` - Navigate to Profiles
- `g` then `y` - Navigate to Replays
- `g` then `r` - Navigate to Releases
- `g` then `e` - Navigate to Alerts
- `g` then `n` - Navigate to Frontend Insights
- `g` then `b` - Navigate to Backend Insights
- `g` then `Shift+M` - Navigate to Mobile Insights
- `g` then `a` - Navigate to AI Insights
- `g` then `c` - Navigate to Crons
- `g` then `u` - Navigate to Uptime
- `g` then `s` - Navigate to Settings
- `g` then `m` - Navigate to Members
- `g` then `Shift+T` - Navigate to Teams

### 4. Test Issues List Navigation

When on the Issues page, you can use:

- `j` - Move focus to next issue (shows purple outline)
- `k` - Move focus to previous issue (shows purple outline)
- `x` - Toggle selection of focused issue
- `enter` - Open the focused issue
- `r` - Resolve the focused issue
- `e` - Archive (ignore) the focused issue

The focused issue will have a purple outline to indicate keyboard focus.

These shortcuts appear in the help modal under the "Issues" category.

**Note**: The `a` shortcut for assigning issues will be implemented in a future update as it requires an assignee selection UI.

### 5. Test Command Palette

The existing command palette shortcuts should still work:

- `cmd+k` (Mac) or `ctrl+k` (Windows/Linux)
- `cmd+shift+p` or `ctrl+shift+p`

## Adding New Shortcuts

### Global Shortcuts

Add to `globalShortcuts.tsx`:

```typescript
{
  id: 'unique-id',
  key: 'shortcut-key', // e.g., 'cmd+s' or 'g h' for sequences
  description: 'What this shortcut does',
  category: 'navigation', // or 'global', 'actions', etc.
  handler: () => {
    // Your handler code
  }
}
```

### Component-Specific Shortcuts

In your component:

```typescript
import {useComponentShortcuts} from 'sentry/utils/keyboardShortcuts';

function MyComponent() {
  useComponentShortcuts('my-component', [
    {
      id: 'save',
      key: 'cmd+s',
      description: 'Save changes',
      handler: () => handleSave(),
    },
  ]);

  return <div>...</div>;
}
```

## Example: Issues List Navigation

The Issues list now has keyboard navigation implemented in `keyboardNavigation.tsx`:

```typescript
// Register shortcuts for a component
useComponentShortcuts('issues-list', [
  {
    id: 'navigate-down',
    key: 'j',
    description: 'Next issue',
    category: 'issues',
    handler: () => moveFocus('down'),
  },
  {
    id: 'navigate-up',
    key: 'k',
    description: 'Previous issue',
    category: 'issues',
    handler: () => moveFocus('up'),
  },
]);
```

## Architecture Overview

- **Registry** (`registry.ts`) - Central registry for all shortcuts
- **Provider** (`shortcutsProvider.tsx`) - React context provider
- **Types** (`types.ts`) - TypeScript interfaces
- **Components** (`components/`) - UI components for displaying shortcuts
- **Hooks** (`hooks/`) - React hooks for using shortcuts
- **Global Shortcuts** (`globalShortcuts.tsx`) - App-wide navigation shortcuts

## Known Limitations in MVP

1. Visual sequence indicator not yet implemented (shows in console)
2. Command palette integration pending
3. No shortcut customization yet
4. No analytics tracking yet

## Next Steps

See the implementation plan in `/keyboard-shortcuts-implementation-plan.md` for phases 3 and 4.
