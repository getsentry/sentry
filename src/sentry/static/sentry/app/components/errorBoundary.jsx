import Raven from 'raven-js';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../locale';
import DetailedError from './errors/detailedError';

const Wrapper = styled.div`
  color: ${p => p.theme.gray4};
  padding: ${p => p.theme.grid * 3}px;
`;

const StackTrace = styled.pre`
  white-space: pre-wrap;
  max-width: 1000px;
  margin: auto;
`;

let exclamation = ['Raspberries', 'Snap', 'Frig', 'Welp', 'Uhhhh', 'Hmmm'];

let getExclamation = () => {
  return exclamation[Math.floor(Math.random() * exclamation.length)];
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {error: null};
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
               \n Hopefully we use a good error reporting service, and this will be fixed soon.`
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
export default ErrorBoundary;
