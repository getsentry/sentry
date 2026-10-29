import {useState} from 'react';
import {
  matchesKeyboardEvent,
  parseHotkey,
  useHotkeys as useTanStackHotkeys,
  type ParsedHotkeyChord,
} from '@tanstack/react-hotkeys';

import {canonicalize} from './keyMappings';

type Hotkey = {
  /**
   * The callback triggered when the matching key is pressed
   */
  callback: (e: KeyboardEvent) => void;
  /**
   * Defines the matching shortcuts.
   *
   * Multiple shortcuts may be passed as a list.
   *
   * The format for shortcuts is `<modifiers>+<key>` For example `shift+t` or
   * `command+shift+t`.
   */
  match: string[] | string;
  /**
   * When `false`, the hotkey is skipped: the callback never fires and
   * `preventDefault` is never called. Useful for gating a hotkey on state
   * (e.g. only intercept `Escape` while a panel is open) without rebuilding
   * the hotkey array. Defaults to `true`.
   */
  enabled?: boolean;
  /**
   * Allow shortcuts to be triggered while a text input is focused
   */
  includeInputs?: boolean;
  /**
   * Do not call preventDefault on the keydown event
   */
  skipPreventDefault?: boolean;
};

function parseMatch(match: string): ParsedHotkeyChord {
  return parseHotkey(
    match
      .split('+')
      .map(key => {
        const canonical = canonicalize(key);
        return canonical === 'command' ? 'Meta' : canonical;
      })
      .join('+')
  );
}

function matchesChord(chord: ParsedHotkeyChord, event: KeyboardEvent): boolean {
  if (event.isComposing) {
    return false;
  }

  // Keep layout-produced ASCII characters authoritative when Shift is not held.
  // For example, Cmd++ on AZERTY has code=Slash and must not trigger Cmd+/.
  if (
    chord.key?.length === 1 &&
    event.key?.length === 1 &&
    event.key.charCodeAt(0) <= 0x7f &&
    !event.shiftKey &&
    event.key.toLowerCase() !== chord.key.toLowerCase()
  ) {
    return false;
  }

  return matchesKeyboardEvent(event, chord);
}

/**
 * Returns whether an event should trigger one of the supplied hotkey matches.
 * Uses the same platform-aware modifier and keyboard-layout behavior as
 * useHotkeys, and never matches while an IME is composing text.
 */
export function matchesHotkey(match: string[] | string, event: KeyboardEvent): boolean {
  return (Array.isArray(match) ? match : [match]).some(keyset =>
    matchesChord(parseMatch(keyset), event)
  );
}

/**
 * Pass in the hotkey combinations under match and the corresponding callback
 * function to be called. Separate key names with +. For example,
 * 'command+alt+shift+x'
 *
 * Alternate matchings as an array: ['command+alt+backspace', 'ctrl+alt+delete']
 *
 * Note: you can only use one non-modifier (keys other than shift, ctrl, alt, command) key at a time.
 */
export function useHotkeys(hotkeys: Hotkey[]): void {
  const [handledEvents] = useState(() => new WeakSet<KeyboardEvent>());

  useTanStackHotkeys(
    hotkeys.flatMap(
      ({match, callback, enabled = true, includeInputs, skipPreventDefault}) =>
        (Array.isArray(match) ? match : [match]).map(keyset => {
          const chord = parseMatch(keyset);
          return {
            hotkey: chord,
            callback: (event: KeyboardEvent) => {
              if (handledEvents.has(event) || !matchesChord(chord, event)) {
                return;
              }
              handledEvents.add(event);
              if (!skipPreventDefault) {
                event.preventDefault();
              }
              callback(event);
            },
            options: {enabled, ignoreInputs: !includeInputs},
          };
        })
    ),
    {
      conflictBehavior: 'allow',
      // Apply preventDefault after the layout and first-match checks above.
      preventDefault: false,
      stopPropagation: false,
    }
  );
}
