import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {growIn} from 'app/styles/animations';
import {Theme} from 'app/utils/theme';

type CheckedProps = React.HTMLProps<HTMLInputElement> & {theme: Theme};

const checkedCss = (p: CheckedProps) => css`
  display: block;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background-color: ${p.theme.green300};
  animation: 0.2s ${growIn} ease;
  opacity: ${p.disabled ? 0.4 : null};
`;

const Radio = styled('input')`
  display: flex;
  padding: 0;
  width: 1.5em;
  height: 1.5em;
  position: relative;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  border: 1px solid ${p => p.theme.border};
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.04);
  background: none;
  appearance: none;

  /* TODO(bootstrap): Our bootstrap CSS adds this, we can remove when we remove that */
  margin: 0 !important;

  &:focus,
  &.focus-visible {
    outline: none !important;
    border: 1px solid ${p => p.theme.border};
    box-shadow: rgba(209, 202, 216, 0.5) 0 0 0 3px;
  }

  &:checked:after {
    content: '';
    ${checkedCss}
  }
`;

Radio.defaultProps = {
  type: 'radio',
};

export default Radio;
