import Raven from 'raven-js';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../locale';
import DetailedError from './errors/detailedError';
import Button from './buttons/button';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  color: ${p => p.theme.gray4};
  padding: ${p => p.theme.grid * 3}px;
`;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {error: null};
  }
  componentDidCatch(error, errorInfo) {
    this.setState({error});
    Raven.captureException(error, {extra: errorInfo});
  }
  openFeedback() {
    if (window.Raven) {
      window.Raven.lastEventId() && window.Raven.showReportDialog();
    }
  }
  render() {
    if (this.state.error) {
      return (
        <Wrapper>
          <DetailedError
            heading={t('Aw crap')}
            message={t(
              `Something went horribly wrong rendering this page.
               \n Thankfully, we use Sentry, so the team has been notified and it should be fixed soon!`
            )}
          />
          <Button className="pull-right" onClick={this.openFeedback}>
            {t('Fill out a report')}
          </Button>
          <pre>{this.state.error.toString()}</pre>
        </Wrapper>
      );
    } else {
      //when there's not an error, render children untouched
      return this.props.children;
    }
  }
}
export default ErrorBoundary;
