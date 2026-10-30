import styled from '@emotion/styled';
import {isMac} from '@react-aria/utils';
import {
  formatForDisplay,
  type CanonicalModifier,
  type HotkeyChord,
} from '@tanstack/react-hotkeys';

import {Kbd} from '@sentry/scraps/hotkey/kbd';

import {resolveKeyGlyph} from './keyMappings';

interface HotkeyProps {
  /**
   * Shortcuts in TanStack's native syntax, such as `"Mod+K"` or `"Shift+Enter"`.
   * A single modifier can also be displayed, such as `"Mod"` or `"Shift"`.
   *
   * Platform modifiers are mapped automatically:
   * - `Mod` renders as `⌘` on Mac, `Ctrl` on other platforms
   * - `Control` renders as `⌃` on Mac, `Ctrl` on other platforms
   * - `Alt` renders as `⌥` on Mac, `Alt` on other platforms
   *
   * Pass an array only when the actual keys differ across platforms
   * (not just modifier names). The first combo is displayed:
   *
   * ```tsx
   * <Hotkey value={['Mod+Backspace', 'Delete']} />
   * ```
   */
  value: HotkeyChord | CanonicalModifier | 'Mod' | readonly HotkeyChord[];
  variant?: 'embossed' | 'debossed';
}

export function Hotkey({value, variant}: HotkeyProps) {
  const hotkey = typeof value === 'string' ? value : value[0];
  if (!hotkey) {
    return null;
  }

  const finalKeys = formatForDisplay(hotkey, {
    platform: isMac() ? 'mac' : 'linux',
    parts: true,
    keyLabels: {Delete: 'Del', Tab: 'Tab', Space: 'Space'},
  }).map(resolveKeyGlyph);

  return (
    <WrapperKbd variant={variant}>
      {finalKeys.map((glyph, i) =>
        'icon' in glyph ? (
          <StyledKbd key={i} aria-label={glyph.label}>
            {glyph.icon}
          </StyledKbd>
        ) : (
          <StyledKbd key={i}>{glyph.label}</StyledKbd>
        )
      )}
    </WrapperKbd>
  );
}

const WrapperKbd = styled(Kbd)`
  padding: 0 ${p => p.theme.space.xs};
  gap: ${p => p.theme.space['2xs']};
`;

const StyledKbd = styled('kbd')`
  scale: 0.9;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  background: none;
  border: 0;
  border-radius: 0;
  box-shadow: none;
`;
