import {Theme} from 'app/utils/theme';

const layout = (theme: Theme, scrollBarWidth?: number) => `
display: grid;

> * {
  :nth-child(4n) {
    text-align: right;
  }
  :nth-child(4n-1) {
    display: none;
  }
}

grid-template-columns: 0.5fr 1fr 0.5fr ${scrollBarWidth ? `${scrollBarWidth}px` : `0fr`};

@media (min-width: ${theme.breakpoints[0]}) {
  > *:nth-child(4n-1) {
    display: flex;
  }
  grid-template-columns: 1fr 2fr 1.5fr 0.6fr ${
    scrollBarWidth ? `${scrollBarWidth}px` : `0fr`
  };
}

@media (min-width: ${theme.breakpoints[3]}) {
  grid-template-columns: 1fr 1.5fr 1.5fr 0.6fr ${
    scrollBarWidth ? `${scrollBarWidth}px` : `0fr`
  };
}

@media (min-width: ${theme.breakpoints[4]}) {
  grid-template-columns: 0.5fr 1.5fr 1fr 0.5fr ${
    scrollBarWidth ? `${scrollBarWidth}px` : `0fr`
  };
}

`;

export default layout;
