import PropTypes from 'prop-types';
import Raven from 'raven-js';
import React from 'react';

import {t} from '../locale';
import LoadingError from './loadingError';
import LoadingIndicator from '../components/loadingIndicator';

class LazyLoad extends React.Component {
  static propTypes = {
    hideBusy: PropTypes.bool,
    hideError: PropTypes.bool,
    /**
     * Function that returns a promise of a React.Component
     */
    component: PropTypes.func,

    /**
     * Also accepts a route object from react-router that has a `componentPromise` property
     */
    route: PropTypes.shape({
      path: PropTypes.string,
      componentPromise: PropTypes.func,
    }),
  };

  constructor(...args) {
    super(...args);
    this.state = {
      Component: null,
      error: null,
    };
  }

  componentDidMount() {
    this.fetchComponent();
  }

  componentWillReceiveProps(nextProps, nextState) {
    // This is to handle the following case:
    // <Route path="a/">
    //   <Route path="b/" component={LazyLoad} componentPromise={...} />
    //   <Route path="c/" component={LazyLoad} componentPromise={...} />
    // </Route>
    //
    // `LazyLoad` will get not fully remount when we switch between `b` and `c`,
    // instead will just re-render.  Refetch if route paths are different
    if (nextProps.route && nextProps.route === this.props.route) return;

    // If `this.fetchComponent` is not in callback,
    // then there's no guarantee that new Component will be rendered
    this.setState(
      {
        Component: null,
      },
      this.fetchComponent
    );
  }

  getComponentGetter = () => this.props.component || this.props.route.componentPromise;

  fetchComponent = () => {
    let getComponent = this.getComponentGetter();

    getComponent()
      .then(
        Component => {
          // Always load default export if available
          this.setState({
            Component: Component.default || Component,
          });
        },
        err => {
          this.setState({
            error: err,
          });
        }
      )
      .catch(err => {
        // eslint-disable-next-line no-console
        console.warn(err);
        Raven.captureException(err);
        this.setState({
          error: err,
        });
      });
  };

  fetchRetry = () => {
    this.setState(
      {
        error: null,
      },
      () => this.fetchComponent()
    );
  };

  render() {
    let {Component, error} = this.state;
    // eslint-disable-next-line no-unused-vars
    let {hideBusy, hideError, component, ...otherProps} = this.props;

    if (error && !hideError) {
      return (
        <LoadingError
          onRetry={this.fetchRetry}
          message={t('There was an error loading a component.')}
        />
      );
    }

    if (!Component && !hideBusy) return <LoadingIndicator />;

    return <Component {...otherProps} />;
  }
}

export default LazyLoad;
