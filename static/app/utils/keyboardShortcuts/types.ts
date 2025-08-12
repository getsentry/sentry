/**
 * Core types for the keyboard shortcuts system
 */

export interface Shortcut {
  /** Unique identifier for the shortcut */
  id: string;
  /** Key combination(s) - can be a string or array of strings for multiple bindings */
  key: string | string[];
  /** Human-readable description of what the shortcut does */
  description: string;
  /** Category for grouping in the help modal */
  category: 'global' | 'navigation' | 'actions' | 'search' | string;
  /** Component context where this shortcut is active (optional for global shortcuts) */
  context?: string;
  /** Handler function called when the shortcut is triggered */
  handler: (event: KeyboardEvent) => void;
  /** Whether the shortcut is currently enabled */
  enabled?: boolean;
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
  /** Allow shortcut to work when input elements are focused */
  allowInInputs?: boolean;
  /** Higher numbers take precedence when conflicts occur */
  priority?: number;
}

export interface ShortcutContext {
  /** Unique name for the context */
  name: string;
  /** Shortcuts registered in this context */
  shortcuts: Shortcut[];
  /** When this context was registered (for ordering) */
  registeredAt: number;
}

export interface ShortcutRegistry {
  /** Register a single shortcut */
  register(shortcut: Shortcut): void;
  /** Unregister a shortcut by ID */
  unregister(shortcutId: string): void;
  /** Register multiple shortcuts for a specific context */
  registerContext(context: string, shortcuts: Shortcut[]): void;
  /** Unregister all shortcuts for a context */
  unregisterContext(context: string): void;
  /** Get all shortcuts, optionally filtered by context */
  getShortcuts(context?: string): Shortcut[];
  /** Get shortcuts grouped by category */
  getShortcutsByCategory(category: string): Shortcut[];
  /** Get list of currently active contexts */
  getActiveContexts(): string[];
  /** Check if a specific key combination is already registered */
  isKeyRegistered(key: string, context?: string): boolean;
}

export interface ShortcutsContextValue {
  /** The registry instance */
  registry: ShortcutRegistry;
  /** Currently active shortcuts based on context */
  activeShortcuts: Shortcut[];
  /** Register shortcuts for a component context */
  registerContext: (context: string, shortcuts: Shortcut[]) => void;
  /** Unregister shortcuts for a component context */
  unregisterContext: (context: string) => void;
  /** Check if the help modal is open */
  isHelpModalOpen: boolean;
  /** Open the help modal */
  openHelpModal: () => void;
  /** Close the help modal */
  closeHelpModal: () => void;
}
