import {css, useTheme} from '@emotion/react';
import {isMac as detectIsMac} from '@react-aria/utils';

import {toArray} from 'sentry/utils/array/toArray';

import {Kbd} from './kbd';
import {resolveKeyGlyph} from './keyMappings';

export interface HotkeyProps {
  /**
   * Key combination string(s) in the same format as `useHotkeys` match strings.
   * Keys are separated by `+`. For example: `"command+k"`, `"shift+enter"`.
   *
   * Platform modifiers are mapped automatically:
   * - `command` renders as `⌘` on Mac, `CTRL` on other platforms
   * - `ctrl` renders as `⌃` on Mac, `CTRL` on other platforms
   * - `alt`/`option` renders as `⌥` on Mac, `ALT` on other platforms
   *
   * Pass an array only when the actual keys differ across platforms
   * (not just modifier names). The first compatible combo is used:
   *
   * ```tsx
   * <Hotkey value={['command+backspace', 'delete']} />
   * ```
   */
  value: string | string[];
}

export function Hotkey({value}: HotkeyProps) {
  const theme = useTheme();
  const isMac = detectIsMac();

  const keySets = toArray(value).map(v => v.trim().split('+'));

  // Resolve glyphs for each key set
  const resolved = keySets.map(keys => keys.map(key => resolveKeyGlyph(key, isMac)));

  // If multiple combos provided, prefer the first one.
  // (With auto platform mapping, a single string works cross-platform,
  // so the array form is only for truly different key combos.)
  const finalKeys = resolved[0];

  if (!finalKeys || finalKeys.length === 0) {
    return null;
  }

  return (
    <kbd
      css={css`
        display: inline-flex;
        align-items: center;
        gap: ${theme.space.xs};
        font-family: inherit;
        font-size: inherit;
        background: none;
        border: none;
        padding: 0;
        margin: 0;
      `}
    >
      {finalKeys.map((glyph, i) => (
        <Kbd key={i}>{glyph}</Kbd>
      ))}
    </kbd>
  );
}
