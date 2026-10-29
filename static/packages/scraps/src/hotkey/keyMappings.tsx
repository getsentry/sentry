import type * as React from 'react';
import {isMac} from '@react-aria/utils';
import {IconArrow} from '@sentry/icons/arrow';
import {IconCommand} from '@sentry/icons/command';
import {IconControl} from '@sentry/icons/control';
import {IconOption} from '@sentry/icons/option';
import {IconReturn} from '@sentry/icons/return';
import {IconShift} from '@sentry/icons/shift';
import type {SVGIconProps} from '@sentry/icons/svgIcon';
import * as Sentry from '@sentry/react';

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
  // `mod` is the platform-aware modifier: command on macOS, control elsewhere.
  // Prefer it over hardcoded `command`/`ctrl` pairs in match strings.
  if (lower === 'mod') {
    return isMac() ? 'command' : 'control';
  }
  return aliases[lower] ?? lower;
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
export function resolveKeyGlyph(keyName: string): KeyGlyph {
  const key = canonicalize(keyName);
  const platformGlyphs = isMac() ? macGlyphs : otherGlyphs;
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

  return {
    label: keyName.replace(
      /\w\S*/g,
      word => word.charAt(0).toUpperCase() + word.substring(1)
    ),
  };
}
