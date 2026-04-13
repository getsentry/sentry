import styled from '@emotion/styled';
import {isMac as detectIsMac} from '@react-aria/utils';

import {toArray} from 'sentry/utils/array/toArray';

import {Kbd} from './kbd';
import {resolveKeyGlyph} from './keyMappings';

interface HotkeyProps {
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
  variant?: 'embossed' | 'debossed';
}

export function Hotkey({value, variant}: HotkeyProps) {
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
    <WrapperKbd variant={variant}>
      {finalKeys.map((glyph, i) => (
        <StyledKbd key={i}>{glyph}</StyledKbd>
      ))}
    </WrapperKbd>
  );
}

const WrapperKbd = styled(Kbd)`
  padding: 0 ${p => p.theme.space.xs};
  gap: ${p => p.theme.space['2xs']};
`;

const StyledKbd = styled('kbd')`
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  font-family: inherit;
  font-size: inherit;
  background: none;
  border: 0;
  border-radius: ${p => p.theme.radius['2xs']};
  box-shadow: none;
`;
