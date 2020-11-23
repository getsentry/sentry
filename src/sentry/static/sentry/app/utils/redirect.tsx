import React from 'react';
import * as ReactRouter from 'react-router';
import {LocationDescriptor} from 'history';
import PropTypes from 'prop-types';

type Props = {
  router: ReactRouter.InjectedRouter;
  to: LocationDescriptor;
};

// This is react-router v4 <Redirect to="path/" /> component to allow things
// to be declarative.
class Redirect extends React.Component<Props> {
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
