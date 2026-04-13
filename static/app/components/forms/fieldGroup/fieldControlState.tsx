import styled from '@emotion/styled';

import type {FieldGroupProps} from './types';

type FieldControlStateProps = Pick<FieldGroupProps, 'flexibleControlStateSize'>;

export const FieldControlState = styled('div')<FieldControlStateProps>`
  display: flex;
  position: relative;
  flex-shrink: 0;
  justify-content: end;
  align-items: center;

  ${p =>
    p.flexibleControlStateSize
      ? `&:not(:empty) { margin-left: ${p.theme.space.lg} }`
      : `width: 24px; margin-left: ${p.theme.space.xs};`};
`;
