import type {ErrorInfo} from 'react';
import {Component, Suspense} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {isWebpackChunkLoadingError} from 'sentry/utils';

type Props<C extends React.LazyExoticComponent<C>> = React.ComponentProps<C> & {
  /**
   * Wrap the component with `lazy()` before passing it to LazyLoad.
   * This should be declared outside of the render funciton.
   */
  LazyComponent: C;

  /**
   * Override the default fallback component.
   *
   * Try not to load too many unique components for the fallback!
   */
  loadingFallback?: React.ReactNode | undefined;
};

/**
 * LazyLoad is used to dynamically load codesplit components via a `import`
 * call. This is primarily used in our routing tree.
 *
 * Outside the render path
 * const LazyComponent = lazy(() => import('./myComponent'))
 *
 * <LazyLoad LazyComponent={LazyComponent} someComponentProps={...} />
 */
function LazyLoad<C extends React.LazyExoticComponent<any>>({
  LazyComponent,
  loadingFallback,
  ...props
}: Props<C>) {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          loadingFallback ?? (
            <LoadingContainer>
              <LoadingIndicator />
            </LoadingContainer>
          )
        }
      >
        {/* Props are strongly typed when passed in, but seem to conflict with LazyExoticComponent */}
        <LazyComponent {...(props as any)} />
      </Suspense>
    </ErrorBoundary>
  );
}

interface ErrorBoundaryState {
  error: Error | null;
  hasError: boolean;
}

// Error boundaries currently have to be classes.
class ErrorBoundary extends Component<{children: React.ReactNode}, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      error,
    };
  }

  state = {hasError: false, error: null};

  componentDidMount(): void {
    // Reset error state on HMR (Hot Module Replacement) in development
    // This ensures that when React Fast Refresh occurs, the error boundary
    // doesn't persist stale error state after code fixes
    if (process.env.NODE_ENV === 'development') {
      if (typeof module !== 'undefined' && module.hot) {
        module.hot.accept(this.handleRetry);
      }
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.withScope(scope => {
      if (isWebpackChunkLoadingError(error)) {
        scope.setFingerprint(['webpack', 'error loading chunk']);
      }
      try {
        // Based on https://github.com/getsentry/sentry-javascript/blob/6f4ad562c469f546f1098136b65583309d03487b/packages/react/src/errorboundary.tsx#L75-L85
        const errorBoundaryError = new Error(error.message);
        errorBoundaryError.name = `React ErrorBoundary ${errorBoundaryError.name}`;
        errorBoundaryError.stack = errorInfo.componentStack!;

        // This will mutate `error` and get captured to Sentry in `RouteError`
        error.cause = errorBoundaryError;
      } catch {
        // Some browsers won't let you write to Error instance
        scope.setExtra('errorInfo', errorInfo);
      } finally {
        Sentry.captureException(error);
      }
    });

    // eslint-disable-next-line no-console
    console.error(error);
  }

  componentWillUnmount(): void {
    // Clean up HMR listeners to prevent memory leaks
    if (process.env.NODE_ENV === 'development') {
      if (typeof module !== 'undefined' && module.hot) {
        module.hot.dispose(this.handleRetry);
      }
    }
  }

  // Reset `hasError` so that we attempt to render `this.props.children` again
  handleRetry = () => this.setState({hasError: false});

  render() {
    if (this.state.hasError) {
      return (
        <LoadingErrorContainer>
          <LoadingError
            onRetry={this.handleRetry}
            message={t('There was an error loading a component.')}
          />
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

export default LazyLoad;
