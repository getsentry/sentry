import {forwardRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {growIn} from 'sentry/styles/animations';

export interface RadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  nativeSize?: React.InputHTMLAttributes<HTMLInputElement>['size'];
  size?: 'sm';
}

export const Radio = styled(
  forwardRef<HTMLInputElement, RadioProps>(
    (
      {
        // Do not forward `size` since it's used for custom styling, not as the
        // native `size` attribute (for that, use `nativeSize` instead)
        size: _size,
        // Use `nativeSize` as the native `size` attribute
        nativeSize,
        ...props
      },
      ref
    ) => <input type="radio" {...props} ref={ref} size={nativeSize} />
  ),
  {
    shouldForwardProp: prop => typeof prop === 'string' && isPropValid(prop),
  }
)`
  ${p => inputStyles(p as any)}
`;

const inputStyles = (p: RadioProps & {theme: Theme}) => css`
  display: flex;
  padding: 0;
  width: ${p.size === 'sm' ? '1rem' : '1.5rem'};
  height: ${p.size === 'sm' ? '1rem' : '1.5rem'};
  position: relative;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  border: 1px solid ${p.theme.border};
  box-shadow: inset ${p.theme.dropShadowMedium};
  background: none;
  appearance: none;
  transition:
    border 0.1s,
    box-shadow 0.1s;

  /* TODO(bootstrap): Our bootstrap CSS adds this, we can remove when we remove that */
  margin: 0 !important;

  &:focus,
  &:focus-visible {
    outline: none;
    border-color: ${p.theme.focusBorder};
    box-shadow: ${p.theme.focusBorder} 0 0 0 1px;
  }

  &:checked:after {
    content: '';
    display: block;
    width: ${p.size === 'sm' ? '0.5rem' : '0.875rem'};
    height: ${p.size === 'sm' ? '0.5rem' : '0.875rem'};
    border-radius: 50%;
    background-color: ${p.theme.active};
    animation: 0.2s ${growIn} ease;
    opacity: ${p.disabled ? 0.4 : null};
  }
`;
