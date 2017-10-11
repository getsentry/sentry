import React from 'react';
import PropTypes from 'prop-types';

import LoadingIndicator from '../components/loadingIndicator';

class LazyLoad extends React.Component {
  static propTypes = {
    hideBusy: PropTypes.bool,
    /**
     * specifically needs to be a thenable
     */
    component: PropTypes.func,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      Component: null,
    };
  }

  componentDidMount() {
    this.props.component().then(Component => {
      this.setState({Component});
    });
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    let {hideBusy, component, ...otherProps} = this.props;
    if (!this.state.Component && !hideBusy) return <LoadingIndicator />;
    return <this.state.Component {...otherProps} />;
  }
}

export default LazyLoad;
