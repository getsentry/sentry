import {Theme} from 'app/utils/theme';

const layout = (theme: Theme) => `
  display: grid;

  > *:nth-child(4n) {
    text-align: right;
  }
  > *:nth-child(4n-1) {
    display: none;
  }

  grid-template-columns: 0.4fr 0.6fr 0.3fr;

  @media (min-width: ${theme.breakpoints[0]}) {
    > *:nth-child(4n-1) {
      display: flex;
    }
    grid-template-columns: 0.5fr 1.3fr 1.4fr 0.4fr;
  }

  @media (min-width: ${theme.breakpoints[2]}) {
    grid-template-columns: 0.5fr 0.9fr 1.4fr 0.5fr;
  }

  @media (min-width: ${theme.breakpoints[3]}) {

    grid-template-columns: 0.4fr 1.5fr 1.4fr 0.4fr;
  }
`;

export default layout;
