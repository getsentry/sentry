import type {ErrorInfo} from 'react';
import {Component, lazy, Suspense, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {isWebpackChunkLoadingError} from 'sentry/utils';
import retryableImport from 'sentry/utils/retryableImport';

type ComponentType = React.ComponentType<any>;

type Props<C extends ComponentType> = React.ComponentProps<C> & {
  /**
   * Wrap the component with lazy() before passing it to LazyLoad.
   */
  LazyComponent: React.LazyExoticComponent<C>;

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
function LazyLoad<C extends ComponentType>({
  component,
  loadingFallback,
  LazyComponent,
  ...props
}: Props<C>) {
  const LazyLoadedComponent = useMemo(() => {
    if (LazyComponent) {
      return LazyComponent;
    }

    return lazy<C>(() => retryableImport(component));
  }, [component, LazyComponent]);

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
        <LazyLoadedComponent {...(props as React.ComponentProps<C>)} />
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.withScope(scope => {
      if (isWebpackChunkLoadingError(error)) {
        scope.setFingerprint(['webpack', 'error loading chunk']);
      }
      scope.setExtra('errorInfo', errorInfo);
      Sentry.captureException(error);
    });

    // eslint-disable-next-line no-console
    console.error(error);
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
