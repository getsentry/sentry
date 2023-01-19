import {Theme} from '@emotion/react';

export const linkStyles = ({disabled, theme}: {theme: Theme; disabled?: boolean}) => `
  border-radius: ${theme.linkBorderRadius};

  &.focus-visible {
    box-shadow: ${theme.linkFocus} 0 0 0 2px;
    text-decoration: none;
    outline: none;
  }

  ${
    disabled &&
    `
      color:${theme.disabled};
      pointer-events: none;
      :hover {
        color: ${theme.disabled};
      }
    `
  }
`;
