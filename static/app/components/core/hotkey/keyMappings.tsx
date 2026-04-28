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
  '\u21E7': 'shift', // ⇧
  return: 'enter',
  esc: 'escape',
  del: 'delete',
  ins: 'insert',
  '\u21EA': 'capslock', // ⇪
};

export function canonicalize(keyName: string): string {
  const lower = keyName.toLowerCase();
  return aliases[lower] ?? lower;
}

// Maps canonical key names to their `event.key` value. Used for keys that
// have a stable cross-layout `event.key` (named keys, arrows, etc.).
const namedKeyMap: Record<string, string> = {
  backspace: 'Backspace',
  tab: 'Tab',
  clear: 'Clear',
  enter: 'Enter',
  escape: 'Escape',
  space: ' ',
  left: 'ArrowLeft',
  up: 'ArrowUp',
  right: 'ArrowRight',
  down: 'ArrowDown',
  delete: 'Delete',
  insert: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  capslock: 'CapsLock',
};

// Maps single-char punctuation to its `event.code` value. Used as a fallback
// alongside `event.key` so shortcuts work even when shift transforms the
// produced character (e.g. `shift+1` produces '!' on US QWERTY).
const punctuationCodeMap: Record<string, string> = {
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  '`': 'Backquote',
  '-': 'Minus',
  '=': 'Equal',
  ';': 'Semicolon',
  "'": 'Quote',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
};

const modifierPredicates: Record<string, (event: KeyboardEvent) => boolean> = {
  command: e => e.metaKey,
  shift: e => e.shiftKey,
  control: e => e.ctrlKey,
  alt: e => e.altKey,
};

export const MODIFIER_KEYS = ['command', 'shift', 'control', 'alt'] as const;

function codeForChar(ch: string): string | undefined {
  if (ch >= 'a' && ch <= 'z') {
    return `Key${ch.toUpperCase()}`;
  }
  if (ch >= '0' && ch <= '9') {
    return `Digit${ch}`;
  }
  return punctuationCodeMap[ch];
}

/**
 * Tests whether a single key name from a hotkey match string is currently
 * pressed in the given keyboard event. Layout-aware: matches against
 * `event.key` (so an AZERTY user pressing the K-labeled key fires `'k'`
 * shortcuts) with `event.code` as a physical-position fallback (so
 * `shift+1` works even though `event.key === '!'` on US QWERTY).
 */
export function matchesKey(name: string, event: KeyboardEvent): boolean {
  const key = canonicalize(name);

  const modifier = modifierPredicates[key];
  if (modifier) {
    return modifier(event);
  }

  const namedKey = namedKeyMap[key];
  if (namedKey) {
    return event.key === namedKey;
  }

  if (key.length === 1) {
    if (event.key.toLowerCase() === key) {
      return true;
    }
    const code = codeForChar(key);
    if (code && event.code === code) {
      return true;
    }
  }

  return false;
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
  shift: {icon: <IconShift {...sharedProps} />, label: '\u21E7'},
  enter: {icon: <IconReturn {...sharedProps} />, label: '\u21B5'},
  left: {icon: <IconArrow {...sharedProps} direction="left" />, label: '\u2190'},
  right: {icon: <IconArrow {...sharedProps} direction="right" />, label: '\u2192'},
  up: {icon: <IconArrow {...sharedProps} direction="up" />, label: '\u2191'},
  down: {icon: <IconArrow {...sharedProps} direction="down" />, label: '\u2193'},
  backspace: {label: '\u232B'},
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
