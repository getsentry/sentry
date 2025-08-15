/**
 * Core types for the keyboard shortcuts system
 */

export interface Shortcut {
  /** Human-readable description of what the shortcut does */
  description: string;
  /** Handler function called when the shortcut is triggered */
  handler: (event: KeyboardEvent) => void;
  /** Unique identifier for the shortcut */
  id: string;
  /** Key combination(s) - can be a string or array of strings for multiple bindings */
  key: string | string[];
  /** Allow shortcut to work when input elements are focused */
  allowInInputs?: boolean;
  /** Component context where this shortcut is active (optional for global shortcuts) */
  context?: string;
  /** Whether the shortcut is currently enabled */
  enabled?: boolean;
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
  /** Higher numbers take precedence when conflicts occur */
  priority?: number;
}

export interface ShortcutContext {
  /** Unique name for the context */
  name: string;
  /** When this context was registered (for ordering) */
  registeredAt: number;
  /** Shortcuts registered in this context */
  shortcuts: Shortcut[];
}

export interface ShortcutRegistry {
  /** Get list of currently active contexts */
  getActiveContexts(): string[];
  /** Get all shortcuts, optionally filtered by context */
  getShortcuts(context?: string): Shortcut[];
  /** Check if a specific key combination is already registered */
  isKeyRegistered(key: string, context?: string): boolean;
  /** Register a single shortcut */
  register(shortcut: Shortcut): void;
  /** Register multiple shortcuts for a specific context */
  registerContext(context: string, shortcuts: Shortcut[]): void;
  /** Unregister a shortcut by ID */
  unregister(shortcutId: string): void;
  /** Unregister all shortcuts for a context */
  unregisterContext(context: string): void;
}

export interface ShortcutsContextValue {
  /** Currently active shortcuts based on context */
  activeShortcuts: Shortcut[];
  /** Close the help modal */
  closeHelpModal: () => void;
  /** Check if the help modal is open */
  isHelpModalOpen: boolean;
  /** Open the help modal */
  openHelpModal: () => void;
  /** Register shortcuts for a component context */
  registerContext: (context: string, shortcuts: Shortcut[]) => void;
  /** The registry instance */
  registry: ShortcutRegistry;
  /** Unregister shortcuts for a component context */
  unregisterContext: (context: string) => void;
}
