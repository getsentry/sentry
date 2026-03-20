import type React from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
// eslint-disable-next-line no-restricted-imports -- need luminosity() to detect low-contrast colors
import Color from 'color';

import {Flex} from '@sentry/scraps/layout';

interface LegendCheckboxProps {
  checked: boolean;
  color: string;
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
  const colorBlendsIn = blendsIntoBackground(color, theme.tokens.background.primary);
  const needsBorder = !checked || colorBlendsIn;

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
        checked={checked}
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
          background: checked ? color : 'transparent',
          border: `1px solid ${needsBorder ? theme.tokens.border.primary : 'transparent'}`,
          pointerEvents: 'none',
        }}
        aria-hidden
      >
        {checked && (
          <CheckIcon
            viewBox="0 0 7 7"
            style={{
              stroke: colorBlendsIn ? theme.tokens.graphics.neutral.vibrant : 'white',
            }}
          >
            <path d="M0.75 3.85639C1.59868 4.70507 2.94787 6.0325 2.92611 6.0325L6.0325 0.75" />
          </CheckIcon>
        )}
      </Flex>
    </Flex>
  );
}

const CHECKBOX_SIZE = '12px';
const ICON_SIZE = '7px';

/**
 * Returns true if the color has too little contrast against the page background
 * to be visible as a checkbox swatch (WCAG contrast ratio < 1.3).
 */
function blendsIntoBackground(color: string, background: string): boolean {
  try {
    return Color(color).contrast(Color(background)) < 1.3;
  } catch {
    return false;
  }
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
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5px;
`;
