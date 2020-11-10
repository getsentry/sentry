import {css} from '@emotion/core';

import {Theme} from 'app/utils/theme';

type Props = {
  disabled?: boolean;
  monospace?: boolean;
  readOnly?: boolean;
  theme: Theme;
};

const inputStyles = (props: Props) =>
  css`
    color: ${props.disabled ? props.theme.disabled : props.theme.gray800};
    display: block;
    width: 100%;
    background: #fff;
    border: 1px solid ${props.theme.border};
    border-radius: ${props.theme.borderRadius};
    box-shadow: inset ${props.theme.dropShadowLight};
    padding: 0.5em;
    transition: border 0.1s linear;
    resize: vertical;

    ${props.monospace ? `font-family: ${props.theme.text.familyMono}` : ''};

    ${props.readOnly
      ? css`
          cursor: default;
        `
      : ''};

    &:focus {
      outline: none;
    }

    &:hover,
    &:focus,
    &:active {
      border: 1px solid ${props.theme.border};
    }

    &::placeholder {
      color: ${props.theme.gray500};
    }

    &[disabled] {
      background: ${props.theme.gray100};
      color: ${props.theme.gray500};
      border: 1px solid ${props.theme.border};
      cursor: not-allowed;

      &::placeholder {
        color: ${props.theme.disabled};
      }
    }

    &.focus-visible {
      box-shadow: rgba(209, 202, 216, 0.5) 0 0 0 3px;
    }
  `;

export {inputStyles};
