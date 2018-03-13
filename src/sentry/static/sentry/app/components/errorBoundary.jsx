import Raven from 'raven-js';
import React from 'react';
import styled from 'react-emotion';
import {browserHistory} from 'react-router';

import {t} from '../locale';
import DetailedError from './errors/detailedError';

let exclamation = ['Raspberries', 'Snap', 'Frig', 'Welp', 'Uhhhh', 'Hmmm'];

let getExclamation = () => {
  return exclamation[Math.floor(Math.random() * exclamation.length)];
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {error: null};
  }

  componentDidMount() {
    // Listen for route changes so we can clear error
    this.unlisten = browserHistory.listen(() => this.setState({error: null}));
  }

  componentWillUnmount() {
    if (this.unlisten) {
      this.unlisten();
    }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({error});
    Raven.captureException(error, {extra: errorInfo});
  }

  render() {
    if (this.state.error) {
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
