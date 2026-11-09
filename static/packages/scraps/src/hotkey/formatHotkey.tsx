import {isMac} from '@react-aria/utils';
import {
  formatForDisplay,
  type CanonicalModifier,
  type HotkeyChord,
} from '@tanstack/react-hotkeys';

export type HotkeyValue =
  | HotkeyChord
  | CanonicalModifier
  | 'Mod'
  | readonly HotkeyChord[];

/**
 * Resolves a hotkey into the platform-specific display labels of each key,
 * such as `['⌘', 'K']` on Mac or `['Ctrl', 'K']` on other platforms.
 */
export function getHotkeyParts(value: HotkeyValue): string[] {
  const hotkey = typeof value === 'string' ? value : value[0];
  if (!hotkey) {
    return [];
  }

  return formatForDisplay(hotkey, {
    platform: isMac() ? 'mac' : 'linux',
    parts: true,
    keyLabels: {Delete: 'Del', Tab: 'Tab', Space: 'Space'},
  });
}

/**
 * Formats a hotkey as a plain, platform-aware string, such as `"⌘K"` on Mac
 * or `"Ctrl K"` on other platforms. Use this where a hotkey needs to be
 * rendered as text rather than as a styled `<Hotkey>` key cap.
 */
export function formatHotkey(value: HotkeyValue): string {
  return getHotkeyParts(value).join(isMac() ? '' : ' ');
}
