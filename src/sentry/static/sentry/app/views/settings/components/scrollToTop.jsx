import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import {callIfFunction} from 'app/utils/callIfFunction';

class ScrollToTop extends React.Component {
  static propTypes = {
    location: PropTypes.object,
    disable: PropTypes.func,
  };

  componentDidUpdate(prevProps) {
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
export default withRouter(ScrollToTop);
