import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {isWebpackChunkLoadingError} from 'app/utils';
import {t} from 'app/locale';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import retryableImport from 'app/utils/retryableImport';

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

  UNSAFE_componentWillReceiveProps(nextProps) {
    // No need to refetch when component does not change
    if (nextProps.component && nextProps.component === this.props.component) {
      return;
    }

    // This is to handle the following case:
    // <Route path="a/">
    //   <Route path="b/" component={LazyLoad} componentPromise={...} />
    //   <Route path="c/" component={LazyLoad} componentPromise={...} />
    // </Route>
    //
    // `LazyLoad` will get not fully remount when we switch between `b` and `c`,
    // instead will just re-render.  Refetch if route paths are different
    if (nextProps.route && nextProps.route === this.props.route) {
      return;
    }

    // If `this.fetchComponent` is not in callback,
    // then there's no guarantee that new Component will be rendered
    this.setState(
      {
        Component: null,
      },
      this.fetchComponent
    );
  }

  componentDidCatch(error) {
    Sentry.captureException(error);
    this.handleError(error);
  }

  getComponentGetter = () => this.props.component || this.props.route.componentPromise;

  handleFetchError = error => {
    Sentry.withScope(scope => {
      if (isWebpackChunkLoadingError(error)) {
        scope.setFingerprint(['webpack', 'error loading chunk']);
      }
      Sentry.captureException(error);
    });
    this.handleError(error);
  };

  handleError = error => {
    // eslint-disable-next-line no-console
    console.error(error);
    this.setState({
      error,
    });
  };

  async fetchComponent() {
    const getComponent = this.getComponentGetter();

    try {
      const Component = await retryableImport(getComponent);
      this.setState({
        Component: Component.default || Component,
      });
    } catch (err) {
      this.handleFetchError(err);
    }
  }

  fetchRetry = () => {
    this.setState(
      {
        error: null,
      },
      () => this.fetchComponent()
    );
  };

  render() {
    const {Component, error} = this.state;
    const {hideBusy, hideError, component: _component, ...otherProps} = this.props;

    if (error && !hideError) {
      return (
        <LoadingErrorContainer>
          <LoadingError
            onRetry={this.fetchRetry}
            message={t('There was an error loading a component.')}
          />
        </LoadingErrorContainer>
      );
    }

    if (!Component && !hideBusy) {
      return (
        <LoadingContainer>
          <LoadingIndicator />
        </LoadingContainer>
      );
    }

    return <Component {...otherProps} />;
  }
}

const LoadingContainer = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
`;

const LoadingErrorContainer = styled('div')`
  flex: 1;
`;

export default LazyLoad;
