import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import type {FieldGroupProps} from './types';

interface FieldLabelProps extends Pick<FieldGroupProps, 'disabled'> {}

export const FieldLabel = styled('div', {
  shouldForwardProp: p => p !== 'disabled' && isPropValid(p),
})<FieldLabelProps>`
  color: ${p => (!p.disabled ? p.theme.textColor : p.theme.disabled)};
  display: flex;
  gap: ${space(0.5)};
  line-height: 16px;
`;
