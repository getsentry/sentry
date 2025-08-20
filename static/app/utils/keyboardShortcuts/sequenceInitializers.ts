/**
 * Configuration for sequence initializer keys
 * These keys are reserved for starting keyboard shortcut sequences
 * and cannot be used as single-key shortcuts
 */

export const SEQUENCE_INITIALIZER_KEYS = ['t', 'g', 'q'] as const;

export type SequenceInitializerKey = (typeof SEQUENCE_INITIALIZER_KEYS)[number];

/**
 * Check if a key is a sequence initializer
 */
export function isSequenceInitializer(key: string): key is SequenceInitializerKey {
  return SEQUENCE_INITIALIZER_KEYS.includes(key as SequenceInitializerKey);
}

/**
 * Extract sequence initializer keys from all active shortcuts
 */
export function getSequenceInitializerKeysFromShortcuts(shortcuts: any[]): Set<string> {
  const sequenceKeys = new Set<string>();

  shortcuts.forEach(shortcut => {
    if (!shortcut.enabled) return;

    const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];

    keys.forEach((key: string) => {
      const keyParts = key.split(' ');

      // If this is a sequence (multiple parts), add the first key as a sequence initializer
      if (keyParts.length > 1) {
        const firstKey = keyParts[0];
        if (
          firstKey &&
          SEQUENCE_INITIALIZER_KEYS.includes(firstKey as SequenceInitializerKey)
        ) {
          sequenceKeys.add(firstKey);
        }
      }
    });
  });

  return sequenceKeys;
}

/**
 * Extract all keys that are used in sequences (not just initializers)
 */
export function getSequenceKeysFromShortcuts(shortcuts: any[]): Set<string> {
  const sequenceKeys = new Set<string>();

  shortcuts.forEach(shortcut => {
    if (!shortcut.enabled) return;

    const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];

    keys.forEach((key: string) => {
      const keyParts = key.split(' ');

      // If this is a sequence (multiple parts), add ALL keys that are part of sequences
      if (keyParts.length > 1) {
        const firstKey = keyParts[0];
        if (SEQUENCE_INITIALIZER_KEYS.includes(firstKey as SequenceInitializerKey)) {
          // Add all keys in the sequence to prevent conflicts
          keyParts.forEach((keyPart: string) => {
            sequenceKeys.add(keyPart);
          });
        }
      }
    });
  });

  return sequenceKeys;
}

/**
 * Validate that no single-key shortcuts conflict with sequence initializer keys
 */
export function validateSequenceInitializerConflicts(shortcuts: any[]): void {
  // Use ALL predefined sequence initializer keys, not just ones detected from existing shortcuts
  const predefinedSequenceInitializers = new Set(SEQUENCE_INITIALIZER_KEYS);

  for (const shortcut of shortcuts) {
    if (!shortcut.enabled) continue;

    const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];

    for (const key of keys) {
      const keyParts = key.split(' ');

      // Check if this is a single-key shortcut that conflicts with predefined sequence initializers
      if (keyParts.length === 1 && predefinedSequenceInitializers.has(key)) {
        throw new Error(
          `Keyboard shortcut conflict: Single-key shortcut "${key}" (${shortcut.id}) conflicts with sequence initializer key. ` +
            `Sequence initializer keys (${Array.from(predefinedSequenceInitializers).join(', ')}) are reserved for sequences only.`
        );
      }
    }
  }
}
