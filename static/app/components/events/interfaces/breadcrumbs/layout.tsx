import {Theme} from 'app/utils/theme';

const layout = (theme: Theme, scrollbarWidth?: number) => {
  const lastColumnSize = scrollbarWidth ? `${scrollbarWidth}px` : '0fr';
  return `
    display: grid;
    > * {
      :nth-child(6n-1) {
        justify-content: flex-end;
        text-align: right;
      }

      :nth-child(6n-2) {
        justify-content: center;
        text-align: center;
      }

      :nth-child(6n-4), :nth-child(6n-2) {
        display: none;
      }

      @media (min-width: ${theme.breakpoints[0]}) {
        :nth-child(6n-4), :nth-child(6n-2) {
          display: flex;
        }
      }

      @media (min-width: ${theme.breakpoints[2]}) {
        :nth-child(6n-2) {
          display: none;
        }
      }

      @media (min-width: ${theme.breakpoints[3]}) {
       :nth-child(6n-2) {
          display: flex;
        }
      }
    }

    grid-template-columns: 0.6fr 01fr 0.7fr ${lastColumnSize};

    @media (min-width: ${theme.breakpoints[0]}) {
      grid-template-columns: 0.6fr 0.7fr 1.5fr 0.6fr 0.7fr ${lastColumnSize};
    }

    @media (min-width: ${theme.breakpoints[2]}) {
      grid-template-columns: 0.6fr 0.7fr 1.5fr 0.7fr ${lastColumnSize};
    }

    @media (min-width: ${theme.breakpoints[3]}) {
      grid-template-columns: 0.6fr 0.7fr 2.5fr 0.6fr 0.7fr ${lastColumnSize};
    }

    @media (min-width: ${theme.breakpoints[4]}) {
      grid-template-columns: 0.6fr 0.7fr 4fr 0.6fr 0.7fr ${lastColumnSize};
    }
  `;
};
export default layout;
