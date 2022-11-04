import styled from '@emotion/styled';

import space from 'sentry/styles/space';

import {FieldGroupProps} from './types';

type FieldControlStateProps = Pick<FieldGroupProps, 'flexibleControlStateSize'>;

const FieldControlState = styled('div')<FieldControlStateProps>`
  display: flex;
  position: relative;
  flex-shrink: 0;
  justify-content: end;
  align-items: center;

  margin-left: ${p => (p.flexibleControlStateSize ? space(1.5) : space(0.5))};
  ${p => !p.flexibleControlStateSize && `width: 24px`};
`;

export default FieldControlState;
