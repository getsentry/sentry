import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {growIn} from 'sentry/styles/animations';

interface CheckedProps extends React.InputHTMLAttributes<HTMLInputElement> {
  disabled?: boolean;
  radioSize?: 'small';
}

const checkedCss = (p: CheckedProps, theme: Theme) => css`
  display: block;
  width: ${p.radioSize === 'small' ? '0.5rem' : '0.875rem'};
  height: ${p.radioSize === 'small' ? '0.5rem' : '0.875rem'};
  border-radius: 50%;
  background-color: ${theme.active};
  animation: 0.2s ${growIn} ease;
  opacity: ${p.disabled ? 0.4 : null};
`;

const Radio = styled((props: CheckedProps) => <input type="radio" {...props} />)`
  display: flex;
  padding: 0;
  width: ${p => (p.radioSize === 'small' ? '1rem' : '1.5rem')};
  height: ${p => (p.radioSize === 'small' ? '1rem' : '1.5rem')};
  position: relative;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  border: 1px solid ${p => p.theme.border};
  box-shadow: inset ${p => p.theme.dropShadowMedium};
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
    border-color: ${p => p.theme.focusBorder};
    box-shadow: ${p => p.theme.focusBorder} 0 0 0 1px;
  }

  &:checked:after {
    content: '';
    ${p => checkedCss(p, p.theme)}
  }
`;

export default Radio;
