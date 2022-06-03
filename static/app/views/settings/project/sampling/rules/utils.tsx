import {Theme} from 'sentry/utils/theme';

export const layout = (theme: Theme) => `
> * {
  :nth-child(-n + 5):nth-child(5n - 1) {
    text-align: right;
  }

  @media (max-width: ${theme.breakpoints[0]}) {
    :nth-child(5n - 4),
    :nth-child(5n - 3) {
      display: none;
    }
  }
}

grid-template-columns: 2fr 1.5fr 1fr;

@media (min-width: ${theme.breakpoints[0]}) {
  grid-template-columns: 48px 1.5fr 2fr 1.5fr 1fr;
}

@media (min-width: ${theme.breakpoints[2]}) {
  grid-template-columns: 48px 2fr 2.5fr 2fr 1.5fr;
}

@media (min-width: ${theme.breakpoints[3]}) {
  grid-template-columns: 48px 2fr 3fr 2fr 1fr;
}
`;
