import isPropValid from '@emotion/is-prop-valid';
import styled, {StyledComponent} from '@emotion/styled';

import {inputStyles} from 'sentry/styles/input';

type Props = Omit<Parameters<typeof inputStyles>[0], 'theme'>;

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
