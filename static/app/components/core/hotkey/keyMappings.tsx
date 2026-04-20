import * as Sentry from '@sentry/react';

import {
  IconArrow,
  IconCommand,
  IconControl,
  IconOption,
  IconReturn,
  IconShift,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

// All non-canonical key names map to their canonical form here
const aliases: Record<string, string> = {
  cmd: 'command',
  meta: 'command',
  '\u2318': 'command', // ⌘
  ctrl: 'control',
  '\u2303': 'control', // ⌃
  option: 'alt',
  '\u2325': 'alt', // ⌥
  '\u21e7': 'shift', // ⇧
  return: 'enter',
  esc: 'escape',
  del: 'delete',
  ins: 'insert',
  '\u21ea': 'capslock', // ⇪
};

function canonicalize(keyName: string): string {
  const lower = keyName.toLowerCase();
  return aliases[lower] ?? lower;
}

// Only uses canonical names
const keyCodeMap: Record<string, number> = {
  backspace: 8,
  tab: 9,
  clear: 12,
  enter: 13,
  escape: 27,
  space: 32,
  left: 37,
  up: 38,
  right: 39,
  down: 40,
  delete: 46,
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
  // Modifiers
  shift: 16,
  alt: 18,
  control: 17,
  command: 91,
  // Punctuation (explicit entries avoid upper-casing surprises)
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

export function getKeyCode(x: string): number {
  const key = canonicalize(x);
  return keyCodeMap[key] ?? x.toUpperCase().charCodeAt(0);
}

type KeyGlyph = {icon: React.ReactNode; label: string} | {label: string};
const sharedProps = {size: 'xs'} satisfies SVGIconProps;

// macOS-specific: modifiers that render differently than other platforms
const macGlyphs: Record<string, KeyGlyph> = {
  command: {icon: <IconCommand {...sharedProps} />, label: '\u2318'},
  control: {icon: <IconControl {...sharedProps} />, label: '\u2303'},
  alt: {icon: <IconOption {...sharedProps} />, label: '\u2325'},
};

// other platforms: same modifiers with text labels
const otherGlyphs: Record<string, KeyGlyph> = {
  command: {label: 'Ctrl'},
  control: {label: 'Ctrl'},
  alt: {label: 'Alt'},
};

// same glyph on all platforms
const universalGlyphs: Record<string, KeyGlyph> = {
  shift: {icon: <IconShift {...sharedProps} />, label: '\u21e7'},
  enter: {icon: <IconReturn {...sharedProps} />, label: '\u21b5'},
  left: {icon: <IconArrow {...sharedProps} direction="left" />, label: '\u2190'},
  right: {icon: <IconArrow {...sharedProps} direction="right" />, label: '\u2192'},
  up: {icon: <IconArrow {...sharedProps} direction="up" />, label: '\u2191'},
  down: {icon: <IconArrow {...sharedProps} direction="down" />, label: '\u2193'},
  backspace: {label: '\u232b'},
  delete: {label: 'Del'},
  tab: {label: 'Tab'},
  escape: {label: 'Esc'},
  space: {label: 'Space'},
  home: {label: 'Home'},
  end: {label: 'End'},
  pageup: {label: 'PageUp'},
  pagedown: {label: 'PageDown'},
  insert: {label: 'Insert'},
  clear: {label: 'Clear'},
  capslock: {label: 'CapsLock'},
};

/**
 * Resolve a key name to its display glyph for the given platform.
 * Non-special keys fall through to title-cased text (e.g. `'k'` → `'K'`).
 */
export function resolveKeyGlyph(keyName: string, isMac: boolean): KeyGlyph {
  const key = canonicalize(keyName);
  const platformGlyphs = isMac ? macGlyphs : otherGlyphs;
  const glyph = platformGlyphs[key] ?? universalGlyphs[key];

  if (glyph) {
    return glyph;
  }

  // Single-char keys (e.g. 'k', '/') are expected to fall through — they just get title-cased.
  // Multi-char keys without a mapping are genuinely missing and should be flagged.
  if (key.length > 1) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`Missing key glyph mapping for "${keyName}"`);
    }
    Sentry.logger.warn('Missing key glyph mapping', {keyName});
  }

  return {label: toTitleCase(keyName, {allowInnerUpperCase: true})};
}
