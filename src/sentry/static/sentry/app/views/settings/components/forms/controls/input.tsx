import styled, {StyledComponent} from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import {inputStyles} from 'app/styles/input';

/**
 * Do not forward required to `input` to avoid default browser behavior
 */
const Input = styled('input', {
  shouldForwardProp: prop => isPropValid(prop) && prop !== 'required',
})`
  ${inputStyles};
`;

// Cast type to avoid exporting theme
export default Input as StyledComponent<JSX.IntrinsicElements['input']>;
