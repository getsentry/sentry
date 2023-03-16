import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import FieldControlState from './fieldControlState';
import {FieldGroupProps} from './types';

type FieldControlProps = Pick<
  FieldGroupProps,
  | 'alignRight'
  | 'controlState'
  | 'flexibleControlStateSize'
  | 'hideControlState'
  | 'inline'
> & {
  children: React.ReactNode;
};

const FieldControl = ({
  inline,
  alignRight,
  controlState,
  children,
  hideControlState,
  flexibleControlStateSize,
}: FieldControlProps) => (
  <FieldControlWrapper inline={inline}>
    <FieldControlStyled alignRight={alignRight}>{children}</FieldControlStyled>

    {!hideControlState && (
      <FieldControlState flexibleControlStateSize={!!flexibleControlStateSize}>
        {controlState}
      </FieldControlState>
    )}
  </FieldControlWrapper>
);

export default FieldControl;

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
