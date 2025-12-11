import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {chonkRadioStyles} from 'sentry/components/core/radio/radio.chonk';

export interface RadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  nativeSize?: React.InputHTMLAttributes<HTMLInputElement>['size'];
  ref?: React.Ref<HTMLInputElement>;
  size?: 'sm';
}

export const Radio = styled(
  ({
    ref,

    // Do not forward `size` since it's used for custom styling, not as the
    // native `size` attribute (for that, use `nativeSize` instead)
    size: _size,

    // Use `nativeSize` as the native `size` attribute
    nativeSize,

    ...props
  }: RadioProps) => <input type="radio" {...props} ref={ref} size={nativeSize} />,
  {
    shouldForwardProp: prop => typeof prop === 'string' && isPropValid(prop),
  }
)`
  ${p => chonkRadioStyles(p)}
`;
