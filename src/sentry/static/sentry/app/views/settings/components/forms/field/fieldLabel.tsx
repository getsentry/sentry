import styled from 'react-emotion';
import isPropValid from '@emotion/is-prop-valid';

const shouldForwardProp = p => p !== 'disabled' && isPropValid(p);

const FieldLabel = styled('div', {shouldForwardProp})<{disabled?: boolean}>`
  color: ${p => (!p.disabled ? p.theme.gray5 : p.theme.gray2)};
`;

export default FieldLabel;
