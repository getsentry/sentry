import styled from '@emotion/styled';

import {Grid, type GridProps} from '@sentry/scraps/layout';

interface ButtonBarProps extends Omit<GridProps, 'gap'> {
  children: NonNullable<React.ReactNode>;
  orientation?: 'horizontal' | 'vertical';
}

export const ButtonBar = styled(
  ({children, orientation = 'horizontal', ...props}: ButtonBarProps) => {
    return (
      <Grid
        flow={orientation === 'horizontal' ? 'column' : 'row'}
        align="center"
        gap="0"
        {...props}
      >
        {children}
      </Grid>
    );
  }
)<ButtonBarProps>`
  /* Raised buttons show borders on both sides. Useful to create pill bars */
  & > .active {
    z-index: 2;
  }

  & > [role='presentation'],
  & > .dropdown,
  & > button,
  & > input,
  & > a {
    position: relative;

    ${p =>
      p.orientation === 'vertical'
        ? `
      /* First button is square on the bottom side */
      &:first-child:not(:last-child) {
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;

        & > .dropdown-actor > button,
        & > .dropdown-actor > a {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }
      }

      /* Middle buttons are square */
      &:not(:last-child):not(:first-child),
      &:not(:last-child):not(:first-child)[role='presentation'] > button,
      &:not(:last-child):not(:first-child)[role='presentation'] > a {
        border-radius: 0;

        & > .dropdown-actor > button,
        & > .dropdown-actor > a {
          border-radius: 0;
        }
      }

      /* Middle buttons only need one border so we don't get a double line */
      & + [role='presentation'] > button,
      & + [role='presentation'] > a,
      & + .dropdown:not(:last-child),
      & + a:not(:last-child),
      & + input:not(:last-child),
      & + button:not(:last-child) {
        margin-top: -1px;
      }

      /* Last button is square on the top side */
      &:last-child:not(:first-child) {
        border-top-left-radius: 0;
        border-top-right-radius: 0;
        margin-top: -1px;

        &[role='presentation'] > button,
        &[role='presentation'] > a,
        & > .dropdown-actor > button,
        & > .dropdown-actor > a {
          border-top-left-radius: 0;
          border-top-right-radius: 0;
          margin-top: -1px;
        }
      }
    `
        : `
      /* First button is square on the right side */
      &:first-child:not(:last-child) {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;

        & > .dropdown-actor > button,
        & > .dropdown-actor > a {
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }
      }

      /* Middle buttons are square */
      &:not(:last-child):not(:first-child),
      &:not(:last-child):not(:first-child)[role='presentation'] > button,
      &:not(:last-child):not(:first-child)[role='presentation'] > a {
        border-radius: 0;

        & > .dropdown-actor > button,
        & > .dropdown-actor > a {
          border-radius: 0;
        }
      }

      /* Middle buttons only need one border so we don't get a double line */
      & + [role='presentation'] > button,
      & + [role='presentation'] > a,
      & + .dropdown:not(:last-child),
      & + a:not(:last-child),
      & + input:not(:last-child),
      & + button:not(:last-child) {
        margin-left: -1px;
      }

      /* Last button is square on the left side */
      &:last-child:not(:first-child) {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        margin-left: -1px;

        &[role='presentation'] > button,
        &[role='presentation'] > a,
        & > .dropdown-actor > button,
        & > .dropdown-actor > a {
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
          margin-left: -1px;
        }
      }
    `}
  }
`;
