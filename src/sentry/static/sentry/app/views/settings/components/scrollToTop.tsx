import { Component } from 'react';
import {Location} from 'history';

import {callIfFunction} from 'app/utils/callIfFunction';

type Props = {
  location: Location;
  disable: (location: Location, prevLocation: Location) => boolean;
};

class ScrollToTop extends Component<Props> {
  componentDidUpdate(prevProps: Props) {
    const {disable, location} = this.props;

    const shouldDisable = callIfFunction(disable, location, prevProps.location);

    if (!shouldDisable && this.props.location !== prevProps.location) {
      window.scrollTo(0, 0);
    }
  }

  render() {
    return this.props.children;
  }
}

export default ScrollToTop;
