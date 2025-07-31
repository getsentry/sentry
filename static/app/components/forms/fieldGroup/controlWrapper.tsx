import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import FieldControlState from './fieldControlState';
import type {FieldGroupProps} from './types';

interface ControlWrapperProps
  extends Pick<
    FieldGroupProps,
    | 'alignRight'
    | 'controlState'
    | 'flexibleControlStateSize'
    | 'hideControlState'
    | 'inline'
  > {
  children?: React.ReactNode;
}

export function ControlWrapper({
  inline,
  alignRight,
  controlState,
  children,
  hideControlState,
  flexibleControlStateSize,
}: ControlWrapperProps) {
  return (
    <FieldControlWrapper inline={inline}>
      <FieldControlStyled alignRight={alignRight}>{children}</FieldControlStyled>

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
  ${p => p.inline && `padding-left: ${space(2)}`};
`;

const FieldControlStyled = styled('div')<{alignRight?: boolean}>`
  display: flex;
  flex: 1;
  flex-direction: column;
  position: relative;
  max-width: 100%;
  ${p => (p.alignRight ? 'align-items: flex-end;' : '')};
`;
