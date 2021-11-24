import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import space from 'sentry/styles/space';

const shouldForwardProp = p => p !== 'disabled' && isPropValid(p);

const FieldLabel = styled('div', {shouldForwardProp})<{disabled?: boolean}>`
  color: ${p => (!p.disabled ? p.theme.textColor : p.theme.disabled)};
  display: flex;
  gap: ${space(0.5)};
  line-height: 16px;
`;

export default FieldLabel;
