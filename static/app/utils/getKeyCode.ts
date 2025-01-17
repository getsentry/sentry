// key maps and utils retrieved from https://github.com/jaywcjlove/hotkeys

/**
 * Includes a lot of leftover unused codes for the future in case we
 * want glyphs for them
 */
const keyNameCodeMapping = {
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
  '⇪': 20,
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

// Modifier Keys
const modifierNameKeyCodeMapping = {
  // shiftKey
  '⇧': 16,
  shift: 16,
  // altKey
  '⌥': 18,
  alt: 18,
  option: 18,
  // ctrlKey
  '⌃': 17,
  ctrl: 17,
  control: 17,
  // metaKey
  '⌘': 91,
  cmd: 91,
  command: 91,
};

export const getKeyCode = (x: string): number =>
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  keyNameCodeMapping[x.toLowerCase()] ||
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  modifierNameKeyCodeMapping[x.toLowerCase()] ||
  x.toUpperCase().charCodeAt(0);
