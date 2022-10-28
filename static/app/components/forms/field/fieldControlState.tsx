import styled from '@emotion/styled';

import {FieldGroupProps} from './types';

type FieldControlStateProps = Pick<FieldGroupProps, 'flexibleControlStateSize'>;

const FieldControlState = styled('div')<FieldControlStateProps>`
  display: flex;
  position: relative;
  ${p => !p.flexibleControlStateSize && `width: 36px`};
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
`;

export default FieldControlState;
