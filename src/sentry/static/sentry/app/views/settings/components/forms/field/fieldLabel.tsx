import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import space from 'app/styles/space';

const shouldForwardProp = p => p !== 'disabled' && isPropValid(p);

const FieldLabel = styled('div', {shouldForwardProp})<{disabled?: boolean}>`
  color: ${p => (!p.disabled ? p.theme.gray800 : p.theme.gray500)};
  display: grid;
  grid-gap: ${space(0.5)};
  grid-template-columns: repeat(2, max-content);
  line-height: 16px;
`;

export default FieldLabel;
