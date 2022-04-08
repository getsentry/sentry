import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {inputStyles} from 'sentry/styles/input';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    Omit<Parameters<typeof inputStyles>[0], 'theme'> {
  type?: React.HTMLInputTypeAttribute;
}

/**
 * Do not forward required to `input` to avoid default browser behavior
 */
const Input = styled('input', {
  shouldForwardProp: prop =>
    typeof prop === 'string' && isPropValid(prop) && prop !== 'required',
})<InputProps>`
  ${inputStyles};
`;

// Cast type to avoid exporting theme
export default Input;
