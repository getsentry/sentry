import type React from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
// eslint-disable-next-line no-restricted-imports -- need luminosity() to detect low-contrast colors
import Color from 'color';

import {Flex} from '@sentry/scraps/layout';

interface LegendCheckboxProps {
  checked: boolean | 'indeterminate';
  color: string | [string, ...string[]];
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  'aria-label'?: string;
}

export function LegendCheckbox({
  checked,
  color,
  onChange,
  'aria-label': ariaLabel,
}: LegendCheckboxProps) {
  const theme = useTheme();
  const isActive = checked === true || checked === 'indeterminate';
  const background = isActive ? colorToBackground(color) : 'transparent';
  const needsBorder = !isActive || blendsIntoBackground(color, theme.type === 'dark');

  return (
    <Flex
      position="relative"
      display="inline-flex"
      align="center"
      flexShrink={0}
      radius="2xs"
      style={{cursor: 'pointer', height: '1.4em'}}
    >
      <HiddenInput
        type="checkbox"
        checked={checked !== 'indeterminate' && checked}
        onChange={onChange}
        aria-label={ariaLabel}
      />

      <Flex
        position="relative"
        align="center"
        justify="center"
        width={CHECKBOX_SIZE}
        height={CHECKBOX_SIZE}
        radius="2xs"
        style={{
          background,
          border: `1px solid ${needsBorder ? theme.tokens.border.primary : 'transparent'}`,
          pointerEvents: 'none',
        }}
        aria-hidden
      >
        {isActive && (
          <CheckIcon viewBox="0 0 7 7">
            {checked === 'indeterminate' ? (
              <path d="M1.25 3.5H5.75" />
            ) : (
              <path d="M0.75 3.85639C1.59868 4.70507 2.94787 6.0325 2.92611 6.0325L6.0325 0.75" />
            )}
          </CheckIcon>
        )}
      </Flex>
    </Flex>
  );
}

const CHECKBOX_SIZE = '12px';
const ICON_SIZE = '7px';
const MAX_GRADIENT_COLORS = 4;

/**
 * Returns true if all colors would be invisible against the page background —
 * very light colors in light mode, very dark colors in dark mode.
 */
function blendsIntoBackground(
  colors: string | [string, ...string[]],
  isDark: boolean
): boolean {
  const list = typeof colors === 'string' ? [colors] : colors;
  return list.every(c => {
    try {
      const luminosity = Color(c).luminosity();
      return isDark ? luminosity < 0.05 : luminosity > 0.9;
    } catch {
      return false;
    }
  });
}

function colorToBackground(colors: string | [string, ...string[]]): string {
  if (typeof colors === 'string') {
    return colors;
  }
  if (colors.length === 1) {
    return colors[0];
  }

  // Diagonal linear gradient with smooth transitions between colors
  const limited = colors.slice(0, MAX_GRADIENT_COLORS);
  return `linear-gradient(135deg, ${limited.join(', ')})`;
}

const HiddenInput = styled('input')`
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  margin: 0;
  padding: 0;
  cursor: pointer;

  &:focus-visible + div {
    ${p => p.theme.focusRing()};
  }
`;

const CheckIcon = styled('svg')`
  width: ${ICON_SIZE};
  height: ${ICON_SIZE};
  fill: none;
  stroke: white;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5px;
`;
