import {Children} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

// Note: This component is also used in Explore multi-query mode
// static/app/views/explore/multiQueryMode/queryConstructors/sortBy.tsx
// and static/app/views/explore/multiQueryMode/queryConstructors/visualize.tsx
// and not just for PageFilters as the name indicates.
interface PageFilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  condensed?: boolean;
}

const PageFilterBar = styled(({children, ...props}: PageFilterBarProps) => {
  return (
    <StyledPageFilterBar listSize={Children.count(children)} {...props}>
      {children}
    </StyledPageFilterBar>
  );
})``;

const StyledPageFilterBar = styled('div')<{listSize: number; condensed?: boolean}>`
  ${p => chonkPageFilterBarStyles(p)}
`;

export default PageFilterBar;

const getChildTransforms = (count: number) => {
  return Array.from(
    {length: count},
    (_, index) => css`
      div:nth-of-type(${index + 1}) > button {
        transform: translateX(-${index}px);
      }
    `
  );
};

const chonkPageFilterBarStyles = (p: {
  listSize: number;
  theme: Theme;
  condensed?: boolean;
}) => css`
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
      @media only screen and (max-width: ${p.theme.breakpoints.sm}) {
        flex-shrink: 1;
      }
    }

    /* Prevent date filter from shrinking below 6.5rem */
    &:last-child {
      min-width: 4rem;
    }
  }

  /* This should not exists. The callers should just wrap the bar in an inline-block element */
  ${p.condensed &&
  css`
    max-width: 100%;
    width: max-content;
  `}

  /* Code related to Chonk styles */

  display: flex;
  position: relative;

  height: ${p.theme.form.md.height};

  & button[aria-haspopup] {
    height: 100%;
    width: 100%;
  }

  /* Disabled InteractionStateLayer */
  & > div > button > span:first-child {
    display: none;
  }

  & > div > button:focus-visible {
    z-index: 3;
  }

  & > div:first-child:not(:last-child) > button {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  & > div:not(:first-child):not(:last-child) > button {
    border-radius: 0;
  }

  & > div:last-child:not(:first-child) > button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  ${getChildTransforms(p.listSize)}
`;
