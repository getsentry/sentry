import {Component} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from 'sentry/components/alert';
import DetailedError from 'sentry/components/errors/detailedError';
import {t} from 'sentry/locale';
import getDynamicText from 'sentry/utils/getDynamicText';

type DefaultProps = {
  mini: boolean;
};

type Props = DefaultProps & {
  // To add context for better UX
  className?: string;
  customComponent?: React.ReactNode;
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

  componentDidMount() {
    this._isMounted = true;
    // Listen for route changes so we can clear error
    this.unlistenBrowserHistory = browserHistory.listen(() => {
      // Prevent race between component unmount and browserHistory change
      // Setting state on a component that is being unmounted throws an error
      if (this._isMounted) {
        this.setState({error: null});
      }
    });
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const {errorTag} = this.props;

    this.setState({error});
    Sentry.withScope(scope => {
      if (errorTag) {
        Object.keys(errorTag).forEach(tag => scope.setTag(tag, errorTag[tag]));
      }

      // Based on https://github.com/getsentry/sentry-javascript/blob/6f4ad562c469f546f1098136b65583309d03487b/packages/react/src/errorboundary.tsx#L75-L85
      const errorBoundaryError = new Error(error.message);
      errorBoundaryError.name = `React ErrorBoundary ${errorBoundaryError.name}`;
      errorBoundaryError.stack = errorInfo.componentStack;

      error.cause = errorBoundaryError;

      scope.setExtra('errorInfo', errorInfo);
      Sentry.captureException(error);
    });
  }

  componentWillUnmount() {
    this._isMounted = false;
    if (this.unlistenBrowserHistory) {
      this.unlistenBrowserHistory();
    }
  }

  private unlistenBrowserHistory?: ReturnType<typeof browserHistory.listen>;
  private _isMounted = false;

  render() {
    const {error} = this.state;

    if (!error) {
      // when there's not an error, render children untouched
      return this.props.children;
    }

    const {customComponent, mini, message, className} = this.props;

    if (typeof customComponent !== 'undefined') {
      return customComponent;
    }

    if (mini) {
      return (
        <Alert type="error" showIcon className={className}>
          {message || t('There was a problem rendering this component')}
        </Alert>
      );
    }

    return (
      <Wrapper data-test-id="error-boundary">
        <DetailedError
          heading={getDynamicText({
            value: getExclamation(),
            fixed: exclamation[0],
          })}
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
  color: ${p => p.theme.textColor};
  padding: ${p => p.theme.grid * 3}px;
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
