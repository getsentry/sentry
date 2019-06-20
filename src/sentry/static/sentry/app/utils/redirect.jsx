import React from 'react';
import PropTypes from 'prop-types';

// This is react-router v4 <Redirect to="path/" /> component to allow things
// to be declarative.
class Redirect extends React.Component {
  static propTypes = {
    router: PropTypes.shape({
      replace: PropTypes.func.isRequired,
    }).isRequired,
    to: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  };

  componentDidMount() {
    this.props.router.replace(this.props.to);
  }

  render() {
    return null;
  }
}

export default Redirect;
