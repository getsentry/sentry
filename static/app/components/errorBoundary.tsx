import {Component} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from 'sentry/components/core/alert';
import {Flex} from 'sentry/components/core/layout';
import DetailedError from 'sentry/components/errors/detailedError';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type DefaultProps = {
  mini: boolean;
};

type CustomComponentRenderProps = {
  error: Error | null;
};

type Props = DefaultProps & {
  // allow the error message to be dismissable, which allows the
  // component that errored to be able to render again. this
  // allows a component like GlobalDrawer to be openable again, otherwise if
  // you hit an error in drawer, you'll need to refresh to see
  // it again. this is because GlobalDrawer is rendered high up
  // in the tree and does not get unmounted, so error state will
  // never change.
  allowDismiss?: boolean;
  children?: React.ReactNode;
  // To add context for better UX
  className?: string;
  customComponent?: ((props: CustomComponentRenderProps) => React.ReactNode) | null;

  // To add context for better error reporting
  errorTag?: Record<string, string>;

  message?: React.ReactNode;
};

type State = {
  error: Error | null;
};

const exclamation = ['Raspberries', 'Snap', 'Frig', 'Welp', 'Uhhhh', 'Hmmm'] as const;

function getExclamation() {
  return exclamation[Math.floor(Math.random() * exclamation.length)];
}

class ErrorBoundary extends Component<Props, State> {
  static defaultProps: DefaultProps = {
    mini: false,
  };

  state: State = {
    error: null,
  };

  componentDidMount(): void {
    // Reset error state on HMR (Hot Module Replacement) in development
    // This ensures that when React Fast Refresh occurs, the error boundary
    // doesn't persist stale error state after code fixes
    if (process.env.NODE_ENV === 'development') {
      if (typeof module !== 'undefined' && module.hot) {
        module.hot.accept(this.handleClose);
      }
    }
  }

  componentDidCatch(_error: Error | string, errorInfo: React.ErrorInfo) {
    const {errorTag} = this.props;

    const error = typeof _error === 'string' ? new Error(_error) : _error;

    this.setState({error});
    Sentry.withScope(scope => {
      if (errorTag) {
        Object.keys(errorTag).forEach(tag => scope.setTag(tag, errorTag[tag]));
      }

      try {
        // Based on https://github.com/getsentry/sentry-javascript/blob/6f4ad562c469f546f1098136b65583309d03487b/packages/react/src/errorboundary.tsx#L75-L85
        const errorBoundaryError = new Error(error.message);
        errorBoundaryError.name = `React ErrorBoundary ${errorBoundaryError.name}`;
        errorBoundaryError.stack = errorInfo.componentStack!;

        error.cause = errorBoundaryError;
      } catch {
        // Some browsers won't let you write to Error instance
        scope.setExtra('errorInfo', errorInfo);
      } finally {
        Sentry.captureException(error);
      }
    });
  }

  componentWillUnmount(): void {
    // Clean up HMR listeners to prevent memory leaks
    if (process.env.NODE_ENV === 'development') {
      if (typeof module !== 'undefined' && module.hot) {
        module.hot.dispose(this.handleClose);
      }
    }
  }

  handleClose = () => {
    this.setState({error: null});
  };

  render() {
    const {error} = this.state;

    if (!error) {
      // when there's not an error, render children untouched
      return this.props.children;
    }

    const {customComponent, mini, message, className} = this.props;

    if (customComponent === null) {
      return null;
    }

    if (customComponent) {
      return customComponent({error: this.state.error});
    }

    if (mini) {
      return (
        <Alert.Container>
          <Alert type="danger" className={className}>
            <Flex align="center" justify="between">
              {message || t('There was a problem rendering this component')}
              {this.props.allowDismiss && <IconClose onClick={this.handleClose} />}
            </Flex>
          </Alert>
        </Alert.Container>
      );
    }

    return (
      <Wrapper data-test-id="error-boundary">
        <DetailedError
          heading={getExclamation()}
          message={t(
            `Something went horribly wrong rendering this page.
We use a decent error reporting service so this will probably be fixed soon. Unless our error reporting service is also broken. That would be awkward.
Anyway, we apologize for the inconvenience.`
          )}
        />
        <StackTrace>{error.toString()}</StackTrace>
      </Wrapper>
    );
  }
}

const Wrapper = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  padding: ${space(3)};
  max-width: 1000px;
  margin: auto;
`;

const StackTrace = styled('pre')`
  white-space: pre-wrap;
  margin: 32px;
  margin-left: 85px;
  margin-right: 18px;
`;

export default ErrorBoundary;
