import isPropValid from '@emotion/is-prop-valid';

import styled from '@emotion/styled';

const shouldForwardProp = p => p !== 'disabled' && isPropValid(p);

const FieldLabel = styled('div', {shouldForwardProp})<{disabled?: boolean}>`
  color: ${p => (!p.disabled ? p.theme.gray5 : p.theme.gray2)};
`;

export default FieldLabel;
