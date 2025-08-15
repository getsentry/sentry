// Main exports for keyboard shortcuts system
export {ShortcutsProvider, useShortcuts} from './shortcutsProvider';
export {useComponentShortcuts} from './hooks/useComponentShortcuts';
export {GlobalShortcuts} from './globalShortcuts';
export {KeyboardKey, KeyboardShortcut} from './components/keyboardKey';
export {shortcutRegistry} from './registry';

// Type exports
export type {
  Shortcut,
  ShortcutContext,
  ShortcutRegistry,
  ShortcutsContextValue,
} from './types';
