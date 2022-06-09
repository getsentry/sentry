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

grid-template-columns: 1fr 0.5fr 66px;

@media (min-width: ${theme.breakpoints[0]}) {
  grid-template-columns: 48px 95px 1fr 0.5fr 66px;
}

@media (min-width: ${theme.breakpoints[2]}) {
  grid-template-columns: 48px 95px 1.5fr 1fr 124px;
}

@media (min-width: ${theme.breakpoints[3]}) {
  grid-template-columns: 48px 95px 1fr 0.5fr 124px;
}
`;
