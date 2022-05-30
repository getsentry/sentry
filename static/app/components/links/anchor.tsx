import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {linkStyles} from './styles';

const Anchor = styled('a', {
  shouldForwardProp: prop =>
    typeof prop === 'string' && isPropValid(prop) && prop !== 'disabled',
})<{disabled?: boolean}>`
  ${linkStyles}
`;

export default Anchor;
