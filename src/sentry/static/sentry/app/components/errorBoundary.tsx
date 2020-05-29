import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/browser';

import {t} from 'app/locale';
import Alert from 'app/components/alert';
import DetailedError from 'app/components/errors/detailedError';

type DefaultProps = {
  mini: boolean;
};

type Props = DefaultProps & {
  message?: React.ReactNode;
  customComponent?: React.ReactNode;
  className?: string;
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
    // Listen for route changes so we can clear error
    this.unlistenBrowserHistory = browserHistory.listen(() =>
      this.setState({error: null})
    );
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({error});
    Sentry.withScope(scope => {
      scope.setExtra('errorInfo', errorInfo);
      Sentry.captureException(error);
    });
  }

  componentWillUnmount() {
    if (this.unlistenBrowserHistory) {
      this.unlistenBrowserHistory();
    }
  }

  // XXX: browserHistory.listen does not have a correct return type.
  unlistenBrowserHistory: any;

  render() {
    const {error} = this.state;

    if (!error) {
      //when there's not an error, render children untouched
      return this.props.children;
    }

    const {customComponent, mini, message, className} = this.props;

    if (customComponent) {
      return customComponent;
    }

    if (mini) {
      return (
        <Alert type="error" icon="icon-circle-exclamation" className={className}>
          {message || t('There was a problem rendering this component')}
        </Alert>
      );
    }

    return (
      <Wrapper>
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
