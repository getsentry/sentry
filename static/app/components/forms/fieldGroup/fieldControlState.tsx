import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import {FieldGroupProps} from './types';

type FieldControlStateProps = Pick<FieldGroupProps, 'flexibleControlStateSize'>;

const FieldControlState = styled('div')<FieldControlStateProps>`
  display: flex;
  position: relative;
  flex-shrink: 0;
  justify-content: end;
  align-items: center;

  ${p =>
    p.flexibleControlStateSize
      ? `&:not(:empty) { margin-left: ${space(1.5)} }`
      : `width: 24px; margin-left: ${space(0.5)};`};
`;

export default FieldControlState;
