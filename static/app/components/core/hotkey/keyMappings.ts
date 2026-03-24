// Key name → keyCode mapping (from https://github.com/jaywcjlove/hotkeys)
const keyNameCodeMapping: Record<string, number> = {
  backspace: 8,
  tab: 9,
  clear: 12,
  enter: 13,
  return: 13,
  esc: 27,
  escape: 27,
  space: 32,
  left: 37,
  up: 38,
  right: 39,
  down: 40,
  del: 46,
  delete: 46,
  ins: 45,
  insert: 45,
  home: 36,
  end: 35,
  pageup: 33,
  pagedown: 34,
  capslock: 20,
  num_0: 96,
  num_1: 97,
  num_2: 98,
  num_3: 99,
  num_4: 100,
  num_5: 101,
  num_6: 102,
  num_7: 103,
  num_8: 104,
  num_9: 105,
  num_multiply: 106,
  num_add: 107,
  num_enter: 108,
  num_subtract: 109,
  num_decimal: 110,
  num_divide: 111,
  '\u21ea': 20,
  ',': 188,
  '.': 190,
  '/': 191,
  '`': 192,
  '-': 189,
  '=': 187,
  ';': 186,
  "'": 222,
  '[': 219,
  ']': 221,
  '\\': 220,
};

const modifierNameKeyCodeMapping: Record<string, number> = {
  '\u21e7': 16,
  shift: 16,
  '\u2325': 18,
  alt: 18,
  option: 18,
  '\u2303': 17,
  ctrl: 17,
  control: 17,
  '\u2318': 91,
  cmd: 91,
  command: 91,
};

/**
 * Get the keyCode for a key name. Used by useHotkeys for event matching.
 */
export function getKeyCode(x: string): number {
  const key = x.toLowerCase();
  return (
    keyNameCodeMapping[key] ??
    modifierNameKeyCodeMapping[key] ??
    x.toUpperCase().charCodeAt(0)
  );
}

// Display glyph mappings

const macGlyphs: Record<string, string> = {
  command: '\u2318',
  cmd: '\u2318',
  meta: '\u2318',
  ctrl: '\u2303',
  control: '\u2303',
  alt: '\u2325',
  option: '\u2325',
  shift: '\u21e7',
};

const genericGlyphs: Record<string, string> = {
  command: 'CTRL',
  cmd: 'CTRL',
  meta: 'CTRL',
  ctrl: 'CTRL',
  control: 'CTRL',
  alt: 'ALT',
  option: 'ALT',
  shift: '\u21e7',
};

const universalGlyphs: Record<string, string> = {
  backspace: '\u232b',
  delete: 'DEL',
  del: 'DEL',
  left: '\u2190',
  up: '\u2191',
  right: '\u2192',
  down: '\u2193',
  enter: '\u21b5',
  return: '\u21b5',
  tab: '\u21e5',
  escape: 'ESC',
  esc: 'ESC',
  space: '\u2423',
};

/**
 * Resolve a key name to its display glyph for the given platform.
 * Non-special keys are uppercased.
 */
export function resolveKeyGlyph(keyName: string, isMac: boolean): string {
  const key = keyName.toLowerCase();
  const platformGlyphs = isMac ? macGlyphs : genericGlyphs;
  return platformGlyphs[key] ?? universalGlyphs[key] ?? keyName.toUpperCase();
}
