import * as React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';
import {isWebpackChunkLoadingError} from 'app/utils';
import retryableImport from 'app/utils/retryableImport';

type PromisedImport<C> = Promise<{default: C}>;

type Component = React.ComponentType<any>;

type Props<C extends Component> = Omit<
  React.ComponentProps<C>,
  'hideBusy' | 'hideError' | 'component' | 'route'
> & {
  hideBusy?: boolean;
  hideError?: boolean;
  /**
   * Function that returns a promise of a React.Component
   */
  component?: () => PromisedImport<C>;
  /**
   * Also accepts a route object from react-router that has a `componentPromise` property
   */
  route?: {componentPromise: () => PromisedImport<C>};
};

type State<C extends Component> = {
  Component: C | null;
  error: any | null;
};

class LazyLoad<C extends Component> extends React.Component<Props<C>, State<C>> {
  state: State<C> = {
    Component: null,
    error: null,
  };

  componentDidMount() {
    this.fetchComponent();
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props<C>) {
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

  componentDidCatch(error: any) {
    Sentry.captureException(error);
    this.handleError(error);
  }

  get componentGetter() {
    return this.props.component ?? this.props.route?.componentPromise;
  }

  handleFetchError = (error: any) => {
    Sentry.withScope(scope => {
      if (isWebpackChunkLoadingError(error)) {
        scope.setFingerprint(['webpack', 'error loading chunk']);
      }
      Sentry.captureException(error);
    });
    this.handleError(error);
  };

  handleError = (error: any) => {
    // eslint-disable-next-line no-console
    console.error(error);
    this.setState({error});
  };

  fetchComponent = async () => {
    const getComponent = this.componentGetter;

    if (getComponent === undefined) {
      return;
    }

    try {
      this.setState({Component: await retryableImport(getComponent)});
    } catch (err) {
      this.handleFetchError(err);
    }
  };

  fetchRetry = () => {
    this.setState({error: null}, this.fetchComponent);
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

    if (Component === null) {
      return null;
    }

    return <Component {...(otherProps as React.ComponentProps<C>)} />;
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
