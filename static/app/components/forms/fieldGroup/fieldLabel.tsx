import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import type {FieldGroupProps} from './types';

interface FieldLabelProps extends Pick<FieldGroupProps, 'disabled'> {}

export const FieldLabel = styled('div', {
  shouldForwardProp: p => p !== 'disabled' && isPropValid(p),
})<FieldLabelProps>`
  color: ${p =>
    p.disabled ? p.theme.tokens.content.disabled : p.theme.tokens.content.primary};
  display: flex;
  gap: ${p => p.theme.space.xs};
  line-height: 16px;
`;
