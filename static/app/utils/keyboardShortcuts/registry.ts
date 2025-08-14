import type {Shortcut, ShortcutContext, ShortcutRegistry} from './types';

/**
 * Core registry for managing keyboard shortcuts
 */
export class KeyboardShortcutRegistry implements ShortcutRegistry {
  private shortcuts: Map<string, Shortcut> = new Map();
  private contexts: Map<string, ShortcutContext> = new Map();

  register(shortcut: Shortcut): void {
    if (!shortcut.id || !shortcut.key) {
      throw new Error('Shortcut must have an id and key');
    }

    // Set default context to 'global' if not specified
    const shortcutWithDefaults: Shortcut = {
      ...shortcut,
      context: shortcut.context || 'global',
      enabled: shortcut.enabled !== false,
      preventDefault: shortcut.preventDefault !== false,
      allowInInputs: shortcut.allowInInputs || false,
      priority: shortcut.priority || 0,
    };

    this.shortcuts.set(shortcut.id, shortcutWithDefaults);
  }

  unregister(shortcutId: string): void {
    this.shortcuts.delete(shortcutId);
  }

  registerContext(context: string, shortcuts: Shortcut[]): void {
    // Create context-specific shortcuts with unique IDs
    const contextShortcuts = shortcuts.map(shortcut => ({
      ...shortcut,
      id: `${context}-${shortcut.id}`, // Make ID unique per context
      context,
    }));

    // Register each shortcut individually
    contextShortcuts.forEach(shortcut => this.register(shortcut));

    // Track the context
    this.contexts.set(context, {
      name: context,
      shortcuts: contextShortcuts,
      registeredAt: Date.now(),
    });
  }

  unregisterContext(context: string): void {
    const contextData = this.contexts.get(context);
    if (contextData) {
      // Remove all shortcuts for this context
      contextData.shortcuts.forEach(shortcut => {
        this.unregister(shortcut.id);
      });
      this.contexts.delete(context);
    }
  }

  getShortcuts(context?: string): Shortcut[] {
    const shortcuts = Array.from(this.shortcuts.values());

    if (context) {
      return shortcuts.filter(s => s.context === context);
    }

    return shortcuts;
  }


  getActiveContexts(): string[] {
    return Array.from(this.contexts.keys());
  }

  isKeyRegistered(key: string, context?: string): boolean {
    const shortcuts = this.getShortcuts(context);
    return shortcuts.some(shortcut => {
      const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];
      return keys.includes(key);
    });
  }

  /**
   * Get the highest priority shortcut for a given key combination
   */
  getShortcutForKey(key: string): Shortcut | undefined {
    const matchingShortcuts = Array.from(this.shortcuts.values()).filter(shortcut => {
      if (!shortcut.enabled) return false;
      const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];
      return keys.includes(key);
    });

    if (matchingShortcuts.length === 0) {
      return undefined;
    }

    // Sort by priority (highest first) and return the highest priority shortcut
    return matchingShortcuts.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
  }
}

// Create a singleton instance
export const shortcutRegistry = new KeyboardShortcutRegistry();
