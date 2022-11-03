import styled from '@emotion/styled';

import space from 'sentry/styles/space';

import {FieldGroupProps} from './types';

type FieldControlStateProps = Pick<FieldGroupProps, 'flexibleControlStateSize'>;

const FieldControlState = styled('div')<FieldControlStateProps>`
  display: flex;
  position: relative;
  ${p => !p.flexibleControlStateSize && `width: 24px`};
  flex-shrink: 0;
  justify-content: end;
  align-items: center;
  margin-left: ${space(0.5)};
`;

export default FieldControlState;
