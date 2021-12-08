import isPropValid from '@emotion/is-prop-valid';
import styled, {StyledComponent} from '@emotion/styled';

import {InputProps as StyledInputProps, inputStyles} from 'sentry/styles/input';

export interface InputProps extends Omit<StyledInputProps, 'theme'> {}

/**
 * Do not forward required to `input` to avoid default browser behavior
 */
const Input = styled('input', {
  shouldForwardProp: prop =>
    typeof prop === 'string' && isPropValid(prop) && prop !== 'required',
})<Props>`
  ${inputStyles};
`;

// Cast type to avoid exporting theme
export default Input as StyledComponent<JSX.IntrinsicElements['input'] & Props>;
