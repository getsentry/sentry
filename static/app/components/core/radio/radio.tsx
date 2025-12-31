import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {growIn} from 'sentry/styles/animations';
import type {StrictCSSObject, Theme} from 'sentry/utils/theme';

export interface RadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  nativeSize?: React.InputHTMLAttributes<HTMLInputElement>['size'];
  ref?: React.Ref<HTMLInputElement>;
  size?: 'sm';
}

const radioConfig = {
  sm: {
    outerSize: '20px',
    innerSize: '10px',
  },
  md: {
    outerSize: '24px',
    innerSize: '12px',
  },
};

const radioStyles = (props: RadioProps & {theme: Theme}): StrictCSSObject => ({
  width: radioConfig[props.size ?? 'md'].outerSize,
  height: radioConfig[props.size ?? 'md'].outerSize,

  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  appearance: 'none',
  transition: `border ${props.theme.motion.smooth.fast}, box-shadow ${props.theme.motion.smooth.fast}`,

  /* TODO(bootstrap): Our bootstrap CSS adds this, we can remove when we remove that */
  margin: '0 !important',
  border: `1px solid ${props.theme.colors.surface100} !important`,

  '&:after': {
    content: '""',
    display: 'block',
    width: radioConfig[props.size ?? 'md'].innerSize,
    height: radioConfig[props.size ?? 'md'].innerSize,
    borderRadius: '50%',
    backgroundColor: props.theme.colors.white,
    transition: `all ${props.theme.motion.smooth.moderate}`,
    opacity: 0,
  },

  '&:focus-visible': {
    ...props.theme.focusRing(),
  },

  '&:checked': {
    backgroundColor: props.theme.colors.chonk.blue400,
    border: `1px solid ${props.theme.colors.chonk.blue400}`,

    '&:after': {
      animation: `${growIn} ${props.theme.motion.smooth.moderate}`,
      opacity: 1,
    },
  },

  '&:disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
});

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
  ${p => radioStyles(p)}
`;
