import {Theme} from '@emotion/react';

const layout = (theme: Theme, scrollbarWidth?: number) => `
display: grid;

> * {
  :nth-child(4n) {
    text-align: right;
  }
  :nth-child(4n-1) {
    display: none;
  }
}

grid-template-columns: 1fr 1.5fr 0.7fr ${scrollbarWidth ? `${scrollbarWidth}px` : `0fr`};

@media (min-width: ${theme.breakpoints.small}) {
  > *:nth-child(4n-1) {
    display: flex;
  }
  grid-template-columns: 1fr 2fr 1.5fr 0.6fr ${
    scrollbarWidth ? `${scrollbarWidth}px` : `0fr`
  };
}

@media (min-width: ${theme.breakpoints.xlarge}) {
  grid-template-columns: 1fr 1.5fr 1.5fr 0.6fr ${
    scrollbarWidth ? `${scrollbarWidth}px` : `0fr`
  };
}

@media (min-width: ${theme.breakpoints.xxlarge}) {
  grid-template-columns: 0.5fr 1.5fr 1fr 0.5fr ${
    scrollbarWidth ? `${scrollbarWidth}px` : `0fr`
  };
}

`;

export default layout;
