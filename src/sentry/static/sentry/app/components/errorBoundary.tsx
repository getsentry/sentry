import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import * as React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {t} from 'app/locale';
import Alert from 'app/components/alert';
import DetailedError from 'app/components/errors/detailedError';
import {IconFlag} from 'app/icons';
import getDynamicText from 'app/utils/getDynamicText';

type DefaultProps = {
  mini: boolean;
};

type Props = DefaultProps & {
  // To add context for better UX
  className?: string;
  customComponent?: React.ReactNode;
  message?: React.ReactNode;

  // To add context for better error reporting
  errorTag?: Record<string, string>;
};

type State = {
  error: Error | null;
};

const exclamation = ['Raspberries', 'Snap', 'Frig', 'Welp', 'Uhhhh', 'Hmmm'] as const;

function getExclamation() {
  return exclamation[Math.floor(Math.random() * exclamation.length)];
}

class ErrorBoundary extends React.Component<Props, State> {
  static propTypes = {
    mini: PropTypes.bool,
    message: PropTypes.node,
    customComponent: PropTypes.node,
  };

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

    if (customComponent) {
      return customComponent;
    }

    if (mini) {
      return (
        <Alert type="error" icon={<IconFlag size="md" />} className={className}>
          {message || t('There was a problem rendering this component')}
        </Alert>
      );
    }

    return (
      <Wrapper>
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
  color: ${p => p.theme.gray700};
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
