import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import * as Sentry from '@sentry/browser';

import {t} from 'app/locale';
import Alert from 'app/components/alert';
import DetailedError from 'app/components/errors/detailedError';

const exclamation = ['Raspberries', 'Snap', 'Frig', 'Welp', 'Uhhhh', 'Hmmm'];

const getExclamation = () => {
  return exclamation[Math.floor(Math.random() * exclamation.length)];
};

class ErrorBoundary extends React.Component {
  static propTypes = {
    mini: PropTypes.bool,
    message: PropTypes.node,
    customComponent: PropTypes.node,
  };

  static defaultProps = {
    mini: false,
  };

  constructor(props) {
    super(props);
    this.state = {error: null};
  }

  componentDidMount() {
    // Listen for route changes so we can clear error
    this.unlistenBrowserHistory = browserHistory.listen(() =>
      this.setState({error: null})
    );
  }

  componentWillUnmount() {
    if (this.unlistenBrowserHistory) {
      this.unlistenBrowserHistory();
    }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({error});
    Sentry.withScope(scope => {
      scope.setExtra('errorInfo', errorInfo);
      Sentry.captureException(error);
    });
  }

  render() {
    if (this.state.error) {
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
          <StackTrace>{this.state.error.toString()}</StackTrace>
        </Wrapper>
      );
    } else {
      //when there's not an error, render children untouched
      return this.props.children;
    }
  }
}

const Wrapper = styled.div`
  color: ${p => p.theme.gray4};
  padding: ${p => p.theme.grid * 3}px;
  max-width: 1000px;
  margin: auto;
`;

const StackTrace = styled.pre`
  white-space: pre-wrap;
  margin: 32px;
  margin-left: 85px;
  margin-right: 18px;
`;

export default ErrorBoundary;
