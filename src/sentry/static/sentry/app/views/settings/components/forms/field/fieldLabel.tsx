import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

const shouldForwardProp = p => p !== 'disabled' && isPropValid(p);

const FieldLabel = styled('div', {shouldForwardProp})<{disabled?: boolean}>`
  color: ${p => (!p.disabled ? p.theme.gray800 : p.theme.gray500)};
  display: grid;
  grid-template-columns: repeat(3, max-content);
  line-height: 16px;
`;

export default FieldLabel;
