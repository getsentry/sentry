import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {withChonk} from 'sentry/utils/theme/withChonk';

// Note: This component is also used in Explore multi-query mode
// static/app/views/explore/multiQueryMode/queryConstructors/sortBy.tsx
// and static/app/views/explore/multiQueryMode/queryConstructors/visualize.tsx
// and not just for PageFilters as the name indicates.
const PageFilterBar = withChonk(
  styled('div')<{condensed?: boolean}>`
    display: flex;
    position: relative;
    border-radius: ${p => p.theme.borderRadius};

    ${p =>
      p.condensed &&
      `
    max-width: 100%;
    width: max-content;
  `}

    &::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      pointer-events: none;
      box-shadow: inset 0 0 0 1px ${p => p.theme.border};
      border-radius: ${p => p.theme.borderRadius};
    }

    & [role='button'] {
      z-index: 0;
    }

    & button[aria-haspopup] {
      height: 100%;
      width: 100%;
      min-height: auto;
      border-color: transparent;
      box-shadow: none;
      z-index: 0;
    }

    /* Less inner padding between buttons */
    & > div:not(:first-child) > button[aria-haspopup] {
      padding-left: ${space(1.5)};
    }
    & > div:not(:last-child) > button[aria-haspopup] {
      padding-right: ${space(1.5)};
    }

    & button[aria-haspopup]:focus-visible {
      border-color: ${p => p.theme.focusBorder};
      box-shadow: 0 0 0 1px ${p => p.theme.focusBorder};
      z-index: 1;
    }

    & > * {
      min-width: 0;
      flex-grow: 1;
      flex-shrink: 1;
      flex-basis: max-content;

      /* Prevent project filter from shrinking (it has in-built max character count)
    except in mobile */
      &:first-child {
        flex-shrink: 0;
        @media only screen and (max-width: ${p => p.theme.breakpoints.small}) {
          flex-shrink: 1;
        }
      }

      /* Prevent date filter from shrinking below 6.5rem */
      &:last-child {
        min-width: 4rem;
      }
    }

    & > *:not(:first-child)::after {
      content: '';
      position: absolute;
      height: 60%;
      width: 1px;
      background-color: ${p => p.theme.innerBorder};
      left: 0;
      top: 50%;
      transform: translateY(-50%);
    }
  `,
  styled('div')<{theme: DO_NOT_USE_ChonkTheme; condensed?: boolean}>`
    /* No idea what this is supposed to style, but I am afraid to remove it */
    & > *:hover::after,
    & > *[data-is-open='true']::after,
    & > *:hover + *:not(:first-child)::after,
    & > *[data-is-open='true'] + *:not(:first-child)::after {
      display: none;
    }

    & > * {
      min-width: 0;
      flex-grow: 1;
      flex-shrink: 1;
      flex-basis: max-content;

      /* Prevent project filter from shrinking (it has in-built max character count)
    except in mobile */
      &:first-child {
        flex-shrink: 0;
        @media only screen and (max-width: ${p => p.theme.breakpoints.small}) {
          flex-shrink: 1;
        }
      }

      /* Prevent date filter from shrinking below 6.5rem */
      &:last-child {
        min-width: 4rem;
      }
    }

    /* This should not exists. The callers should just wrap the bar in an inline-block element */
    ${p =>
      p.condensed &&
      `
    max-width: 100%;
    width: max-content;
  `}

    /* Code related to Chonk styles */

    display: flex;
    position: relative;

    & > div > button {
      width: 100%;
    }

    /* Disabled InteractionStateLayer */
    & > div > button > span:first-child {
      display: none;
    }

    & > div:first-child > button {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }

    & > div:not(:first-child):not(:last-child) > button {
      border-radius: 0;

      &::after {
        border-left: none;
        border-right: none;
      }
    }

    & > div:last-child > button {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
  `
);

export default PageFilterBar;
