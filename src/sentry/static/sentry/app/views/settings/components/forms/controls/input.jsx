import isPropValid from '@emotion/is-prop-valid';

import styled from '@emotion/styled';
import {inputStyles} from 'app/styles/input';

/**
 * Do not forward required to `input` to avoid default browser behavior
 */
const Input = styled('input', {
  shouldForwardProp: prop => isPropValid(prop) && prop !== 'required',
})`
  ${inputStyles};
`;

export default Input;
