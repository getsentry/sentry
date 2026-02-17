import type React from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

const CHECKBOX_SIZE = '12px';
const ICON_SIZE = '10px';

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
  return (
    <Flex
      position="relative"
      display="inline-flex"
      flexShrink={0}
      radius="2xs"
      style={{cursor: 'pointer'}}
    >
      <NativeCheckbox
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
          backgroundColor: checked ? color : 'transparent',
          border: `1px solid ${checked ? color : 'var(--border-primary)'}`,
          pointerEvents: 'none',
        }}
        aria-hidden
      >
        {checked && (
          <CheckIcon viewBox="0 0 16 16">
            <path d="M2.86 9.14C4.42 10.7 6.9 13.14 6.86 13.14L12.57 3.43" />
          </CheckIcon>
        )}
      </Flex>
    </Flex>
  );
}

const NativeCheckbox = styled('input')`
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
  stroke-width: 1.8px;
`;
