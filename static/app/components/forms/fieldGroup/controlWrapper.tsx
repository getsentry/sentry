import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {FieldControlState} from './fieldControlState';
import type {FieldGroupProps} from './types';

interface ControlWrapperProps extends Pick<
  FieldGroupProps,
  'controlState' | 'flexibleControlStateSize' | 'hideControlState' | 'inline'
> {
  children?: React.ReactNode;
  controlAlign?: ControlAlign;
}

type ControlAlign = 'start' | 'end';

export function ControlWrapper({
  inline,
  controlAlign,
  controlState,
  children,
  hideControlState,
  flexibleControlStateSize,
}: ControlWrapperProps) {
  return (
    <FieldControlWrapper inline={inline}>
      <FieldControlStyled controlAlign={controlAlign}>{children}</FieldControlStyled>

      {!hideControlState && (
        <FieldControlState flexibleControlStateSize={!!flexibleControlStateSize}>
          {controlState}
        </FieldControlState>
      )}
    </FieldControlWrapper>
  );
}

const FieldControlWrapper = styled('div')<{inline?: boolean}>`
  display: flex;
  flex: 1;
  ${p => p.inline && `padding-left: ${p.theme.space.xl}`};
`;

const FieldControlStyled = styled('div')<{controlAlign?: ControlAlign}>`
  display: flex;
  flex: 1;
  flex-direction: column;
  position: relative;
  max-width: 100%;
  ${p =>
    p.controlAlign &&
    css`
      align-items: flex-${p.controlAlign};
    `}
`;
