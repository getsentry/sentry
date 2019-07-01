import {hot} from 'react-hot-loader/root';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/browser';

import {isWebpackChunkLoadingError} from 'app/utils';
import {t} from 'app/locale';
import LoadingError from 'app/components/loadingError';

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

  // UNSAFE_componentWillReceiveProps(nextProps) {
  // // No need to refetch when component does not change
  // if (nextProps.component && nextProps.component === this.props.component) {
  // return;
  // }

  // // This is to handle the following case:
  // // <Route path="a/">
  // //   <Route path="b/" component={LazyLoad} componentPromise={...} />
  // //   <Route path="c/" component={LazyLoad} componentPromise={...} />
  // // </Route>
  // //
  // // `LazyLoad` will get not fully remount when we switch between `b` and `c`,
  // // instead will just re-render.  Refetch if route paths are different
  // if (nextProps.route && nextProps.route === this.props.route) {
  // return;
  // }
  // }

  get componentFactory() {
    return this.props.component || this.props.route.componentPromise;
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {hideBusy, hideError, component, ...otherProps} = this.props;
    const Component = React.lazy(this.componentFactory);

    return (
      <LazyLoadErrorBoundary>
        <React.Suspense fallback={!hideBusy ? <LoadingContainer /> : null}>
          <Component {...otherProps} />
        </React.Suspense>
      </LazyLoadErrorBoundary>
    );
  }
}

class LazyLoadErrorBoundary extends React.Component {
  static getDerivedStateFromError(error) {
    return {
      hasError: !!error,
      error,
    };
  }

  state = {
    hasError: false,
    error: null,
  };

  componentDidCatch(error, info) {
    console.error(error); // eslint-disable-line no-console
    console.error(info); // eslint-disable-line no-console
    Sentry.withScope(scope => {
      if (isWebpackChunkLoadingError(error)) {
        scope.setFingerprint(['webpack', 'error loading chunk']);
      }
      Sentry.captureException(error);
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <LoadingErrorContainer>
          <LoadingError message={t('There was an error loading a component.')} />
        </LoadingErrorContainer>
      );
    }

    return this.props.children;
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

export default hot(LazyLoad);
