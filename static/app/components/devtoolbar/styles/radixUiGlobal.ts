import {css} from '@emotion/react';

import {smallCss} from 'sentry/components/devtoolbar/styles/typography';

export const radixUiGlobalCss = css`
  .DropdownMenuContent {
    background: white;
    border: 1px solid var(--gray200);
    border-radius: 6px;
    box-shadow: 0px 10px 15px -3px rgba(0, 0, 0, 0.1);
    padding: var(--space25);

    z-index: calc(var(--z-index) + 1);

    outline: none;
    ${smallCss};
  }

  .DropdownMenuItem {
    padding-inline: var(--space25);
    border-radius: 4px;

    cursor: pointer;
    outline: none;

    position: relative;
    display: grid;
    grid-template-areas:
      'label kbd'
      'desc  kbd';
    align-items: center;
    padding: var(--space50);

    column-gap: 20px;
    forced-color-adjust: none;

    &[data-highlighted] {
      background: var(--gray100);
    }

    &[data-disabled] {
      color: var(--gray300);
    }
  }
`;
