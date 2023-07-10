import styled from '@emotion/styled';

const PageFilterBar = styled('div')<{condensed?: boolean}>`
  display: flex;
  position: relative;
  border-radius: ${p => p.theme.borderRadius};
  height: ${p => p.theme.form.md.height}px;
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

  & button[aria-haspopup].focus-visible {
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
      min-width: 6.5rem;
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

  & > *:hover::after,
  & > *[data-is-open='true']::after,
  & > *:hover + *:not(:first-child)::after,
  & > *[data-is-open='true'] + *:not(:first-child)::after {
    display: none;
  }
`;

export default PageFilterBar;
