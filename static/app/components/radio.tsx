import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {growIn} from 'sentry/styles/animations';
import {Theme} from 'sentry/utils/theme';

type Props = {radioSize?: 'small'};

type CheckedProps = Props &
  Omit<React.HTMLProps<HTMLInputElement>, 'as'> & {theme: Theme};

const checkedCss = (p: CheckedProps) => css`
  display: block;
  width: ${p.radioSize === 'small' ? '0.5rem' : '0.875rem'};
  height: ${p.radioSize === 'small' ? '0.5rem' : '0.875rem'};
  border-radius: 50%;
  background-color: ${p.theme.active};
  animation: 0.2s ${growIn} ease;
  opacity: ${p.disabled ? 0.4 : null};
`;

const Radio = styled('input')<Props>`
  display: flex;
  padding: 0;
  width: ${p => (p.radioSize === 'small' ? '1rem' : '1.5rem')};
  height: ${p => (p.radioSize === 'small' ? '1rem' : '1.5rem')};
  position: relative;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  border: 1px solid ${p => p.theme.border};
  box-shadow: inset ${p => p.theme.dropShadowLight};
  background: none;
  appearance: none;
  transition: border 0.1s, box-shadow 0.1s;

  /* TODO(bootstrap): Our bootstrap CSS adds this, we can remove when we remove that */
  margin: 0 !important;

  &:focus,
  &.focus-visible {
    outline: none;
    border-color: ${p => p.theme.focusBorder};
    box-shadow: ${p => p.theme.focusBorder} 0 0 0 1px;
  }

  &:checked:after {
    content: '';
    ${p => checkedCss(p)}
  }
`;

Radio.defaultProps = {
  type: 'radio',
};

export default Radio;
