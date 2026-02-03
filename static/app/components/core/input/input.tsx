import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {inputStyles, type InputStylesProps} from './inputStyles';

export {type InputStylesProps} from './inputStyles';
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'readOnly'>,
    InputStylesProps {
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * Basic input component.
 *
 * Use the `size` prop ('md', 'sm', 'xs') to control the input's height &
 * padding. To use the native size attribute (which controls the number of
 * characters the input should fit), use the `nativeSize` prop instead.
 *
 * To add leading/trailing items (e.g. a search icon on the left side), use
 * InputControl (components/inputControl) instead.
 */
export const Input = styled(
  ({
    ref,
    // Do not forward `size` since it's used for custom styling, not as the
    // native `size` attribute (for that, use `nativeSize` instead)
    size: _size,

    // Use `nativeSize` as the native `size` attribute
    nativeSize,

    ...props
  }: InputProps) => <input {...props} ref={ref} size={nativeSize} />,
  {shouldForwardProp: prop => prop === 'nativeSize' || isPropValid(prop)}
)`
  ${p => inputStyles(p)};
`;
