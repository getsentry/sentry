import {css, type Theme} from '@emotion/react';

export const linkStyles = ({disabled, theme}: {theme: Theme; disabled?: boolean}) => css`
  border-radius: ${theme.linkBorderRadius};

  &:focus-visible {
    box-shadow: ${theme.linkFocus} 0 0 0 2px;
    text-decoration: none;
    outline: none;
  }

  ${disabled &&
  css`
    color: ${theme.disabled};
    pointer-events: none;
    :hover {
      color: ${theme.disabled};
    }
  `}
`;
