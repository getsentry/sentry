# Keyboard Shortcuts Implementation Plan

## Overview

This plan outlines the implementation of a comprehensive keyboard shortcut system for the Sentry React application, inspired by Gmail and Linear's excellent keyboard navigation patterns. The system will support both global and contextual shortcuts, with a help modal accessible via the `?` key.

## Architecture

### File Structure

All keyboard shortcut-related files will be colocated in `/static/app/utils/keyboardShortcuts/`:

```
/static/app/utils/keyboardShortcuts/
├── registry.ts                           # Core shortcut registry
├── shortcutsProvider.tsx                 # React context provider
├── index.ts                              # Main exports
├── types.ts                              # TypeScript interfaces
├── components/
│   ├── shortcutsHelpModal.tsx           # Help modal component
│   ├── keyboardKey.tsx                  # Key visual component
│   └── shortcutHint.tsx                 # Inline hint component
├── hooks/
│   ├── useComponentShortcuts.tsx        # Component-specific shortcuts hook
│   ├── useShortcuts.tsx                 # General shortcuts hook
│   └── useKeyboardShortcuts.tsx         # Main keyboard handler hook
├── definitions/
│   ├── global.json                      # Global shortcuts
│   ├── issues.json                      # Issues page shortcuts
│   ├── projects.json                    # Project shortcuts
│   ├── dashboards.json                  # Dashboard shortcuts
│   └── settings.json                    # Settings shortcuts
└── utils/
    ├── keyParser.ts                     # Key combination parser
    ├── platformKeys.ts                  # Platform-specific key mappings
    └── shortcutHelpers.ts               # Utility functions
```

### 1. Core Components

#### 1.1 Shortcut Registry (`/static/app/utils/keyboardShortcuts/registry.ts`)
- Centralized registry for all keyboard shortcuts
- Manages global and contextual shortcuts
- Handles shortcut conflicts and priority
- Provides methods for registering/unregistering shortcuts dynamically

```typescript
interface Shortcut {
  id: string;
  key: string | string[]; // e.g., 'g h' or ['cmd+k', 'ctrl+k']
  description: string;
  category: 'global' | 'navigation' | 'actions' | 'search' | string;
  context?: string; // Component context where this shortcut is active
  handler: (event: KeyboardEvent) => void;
  enabled?: boolean;
  preventDefault?: boolean;
  allowInInputs?: boolean;
  priority?: number; // Higher numbers take precedence
}

interface ShortcutRegistry {
  register(shortcut: Shortcut): void;
  unregister(shortcutId: string): void;
  registerContext(context: string, shortcuts: Shortcut[]): void;
  unregisterContext(context: string): void;
  getShortcuts(context?: string): Shortcut[];
  getShortcutsByCategory(category: string): Shortcut[];
  getActiveContexts(): string[];
}
```

#### 1.2 Shortcuts Provider (`/static/app/utils/keyboardShortcuts/shortcutsProvider.tsx`)
- React Context provider for managing shortcuts state
- Handles keyboard event listening at the app level
- Manages shortcut execution based on current route context
- Integrates with existing `useHotkeys` hook

#### 1.3 Help Modal (`/static/app/utils/keyboardShortcuts/components/shortcutsHelpModal.tsx`)
- Beautiful, organized help modal showing all available shortcuts
- Categorized display (Global, Navigation, Actions, etc.)
- Shows contextual shortcuts based on current route
- Searchable shortcuts list
- Visual keyboard key representations

#### 1.4 Declarative Shortcut Definitions (`/static/app/utils/keyboardShortcuts/definitions/`)
- JSON-based shortcut definitions for easy maintenance
- Separate files for different feature areas
- Supports i18n for descriptions

```json
// global.json
{
  "shortcuts": [
    {
      "id": "show-help",
      "key": "?",
      "description": "Show keyboard shortcuts",
      "category": "global",
      "handler": "showShortcutsHelp"
    },
    {
      "id": "search",
      "key": ["cmd+k", "ctrl+k"],
      "description": "Search everywhere",
      "category": "global",
      "handler": "openCommandPalette"
    },
    {
      "id": "go-to-issues",
      "key": "g i",
      "description": "Go to Issues",
      "category": "navigation",
      "handler": "navigateToIssues"
    }
  ]
}
```

### 2. Component-Specific Shortcuts

#### 2.1 Component Shortcut Hook (`/static/app/utils/keyboardShortcuts/hooks/useComponentShortcuts.tsx`)
- Custom hook for registering component-specific shortcuts
- Automatically activates shortcuts when component mounts
- Automatically deactivates shortcuts when component unmounts
- Supports shortcut context scoping based on component hierarchy

```typescript
function useComponentShortcuts(context: string, shortcuts: Shortcut[]) {
  const { registerContext, unregisterContext } = useShortcutsRegistry();

  useEffect(() => {
    // Register shortcuts for this component context
    registerContext(context, shortcuts);

    // Cleanup on unmount
    return () => {
      unregisterContext(context);
    };
  }, [context, shortcuts, registerContext, unregisterContext]);
}

// Usage example:
function IssuesListComponent() {
  useComponentShortcuts('issues-list', [
    {
      id: 'navigate-down',
      key: 'j',
      description: 'Navigate down',
      handler: () => navigateToNextIssue()
    },
    {
      id: 'select-issue',
      key: 'x',
      description: 'Select/deselect issue',
      handler: () => toggleIssueSelection()
    }
  ]);

  return <div>...</div>;
}
```

#### 2.2 Context Priority System
- Shortcuts are organized by context (e.g., 'global', 'issues-list', 'issue-detail')
- When multiple contexts are active, priority determines which shortcuts take precedence
- More specific contexts (components) override global shortcuts
- Context stack allows for nested component shortcuts

#### 2.3 Shortcut Definitions by Feature
- `/static/app/utils/keyboardShortcuts/definitions/issues.json` - Issues page shortcuts
- `/static/app/utils/keyboardShortcuts/definitions/projects.json` - Project shortcuts
- `/static/app/utils/keyboardShortcuts/definitions/dashboards.json` - Dashboard shortcuts
- etc.

### 3. Visual Components

#### 3.1 Keyboard Key Component (`/static/app/utils/keyboardShortcuts/components/keyboardKey.tsx`)
- Styled component for displaying keyboard keys
- Handles platform-specific key symbols (⌘ for Mac, Ctrl for others)
- Consistent visual representation across the app

#### 3.2 Shortcut Hint Component (`/static/app/utils/keyboardShortcuts/components/shortcutHint.tsx`)
- This can be skipped until a later phase
- Inline hint component to show shortcuts in UI
- Can be added to buttons, menu items, etc.
- Example: "Create Issue ⌘N"

### 4. Integration Points

#### 4.1 App Root Integration
- Add `ShortcutsProvider` to the app root
- Initialize global shortcuts on app mount

#### 4.2 Component Integration
- Add `useComponentShortcuts` to components that need contextual shortcuts
- Define shortcuts specific to each component or feature area
- Components automatically register/unregister shortcuts on mount/unmount

#### 4.3 Existing Modal Integration
- Enhance `GlobalModal` to disable shortcuts when modals are open
- Add escape key handling coordination

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
1. Create shortcut registry system
2. Implement ShortcutsProvider and context
3. Create basic help modal structure
4. Integrate with existing `useHotkeys` utility

### Phase 2: Global Shortcuts (Week 2)
1. Implement global navigation shortcuts:
  - `?` - Help modal
  - `g` then `i`: Go to Issues
  - `g` then `p`: Go to Projects
  - `g` then `d`: Go to Dashboards
  - `g` then `r`: Go to Releases
  - `g` then `a`: Go to Alerts
  - `g` then `e`: Go to Performance
  - `g` then `v`: Go to Replays ("v" for Video/Replays)
  - `g` then `m`: Go to Monitors/Crons
  - `g` then `t`: Go to Teams
  - `g` then `o`: Go to Organization overview/Home
2. Create keyboard key visual components
3. Style and polish help modal

### Phase 3: Contextual Shortcuts (Week 3)
1. Issues page shortcuts:
   - `j/k` - Navigate up/down through issues ✓
   - `x` - Select/deselect issue ✓
   - `e` - Archive (ignore) issue ✓
   - `r` - Mark as resolved ✓
   - `a` - Assign issue (requires UI for assignee selection)
   - `enter` - Open selected issue ✓
2. Project shortcuts
3. Dashboard shortcuts
4. Settings shortcuts

### Phase 4: Advanced Features (Week 4)
1. Command palette integration
2.  `/`: Focus the primary search/filter input in the current view (fallback to global search if available)
3. Shortcut conflict detection
4. Analytics integration for shortcut usage
5. Accessibility improvements

## Technical Considerations

### 1. Performance
- Use React.memo for shortcut components
- Debounce keyboard event handlers
- Lazy load shortcut definitions
- Use event delegation for efficiency

### 2. Accessibility
- Ensure shortcuts don't conflict with screen readers
- Provide alternative navigation methods
- Follow WCAG guidelines for keyboard navigation

### 3. Browser Compatibility
- Handle browser-specific key codes
- Test across different OS platforms
- Gracefully handle unsupported key combinations

### 4. Testing Strategy
- Unit tests for registry and utilities
- Integration tests for shortcuts in different contexts
- E2E tests for critical user flows
- Accessibility testing

### 5. Documentation
- Inline documentation in help modal
- Developer documentation for adding new shortcuts
- User documentation in main docs

## Success Metrics
1. Increased navigation speed for power users
2. Reduced clicks for common actions
3. Improved discoverability through help modal
4. Positive user feedback
5. Increased command palette usage

## Future Enhancements
1. Vim-style navigation modes
2. Custom shortcut recording
3. Shortcut sharing between team members
4. Mobile gesture support
5. Voice command integration

## Example Shortcut Patterns (Inspired by Gmail & Linear)

### Navigation Shortcuts
- `g` then `[key]` - Go to specific pages
- `j/k` - Move down/up in lists
- `n/p` - Next/previous item
- `u` - Back to list view

### Action Shortcuts
- `c` - Create new item
- `e` - Edit current item
- `#` - Delete
- `.` - Show more actions menu
- `r` - Reply/respond
- `a` - Archive/assign

### Selection Shortcuts
- `x` - Select current item
- `shift+click` - Select range
- `cmd/ctrl+a` - Select all
- `*` then `a` - Select all
- `*` then `n` - Select none

### Search & Filter
- `/` - Quick search
- `cmd/ctrl+k` - Command palette
- `f` - Filter
- `s` - Star/save

This plan provides a solid foundation for implementing a world-class keyboard shortcut system that will significantly improve the user experience for power users while maintaining accessibility and discoverability for all users.
