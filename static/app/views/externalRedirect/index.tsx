import {Component} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {tct} from 'sentry/locale';

interface ExternalRedirectState {
  count: number;
  redirectUrl: string | null;
}

class ExternalRedirect extends Component<{}, ExternalRedirectState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      count: 5,
      redirectUrl: null,
    };
  }

  componentDidMount() {
    const queryParams = new URLSearchParams(window.location.search);
    const redirectUrl = queryParams.get('url');

    if (redirectUrl) {
      this.setState({redirectUrl});
    }

    this.timer = window.setInterval(() => {
      this.setState(prevState => ({
        count: prevState.count - 1,
      }));
    }, 1000);
  }

  componentDidUpdate() {
    const {count, redirectUrl} = this.state;
    if (count === 0 && redirectUrl) {
      if (this.timer !== null) {
        clearInterval(this.timer);
        this.timer = null;
        window.location.href = redirectUrl;
      }
    }
  }

  componentWillUnmount() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  timer: number | null = null;

  goBack = () => {
    window.close();
  };

  render() {
    const {count, redirectUrl} = this.state;

    return (
      <div className="app">
        <RedirectContainer>
          <div className="pattern-bg" />
          <AuthPanel>
            {tct(
              'You are being redirected to [redirectUrl] in [count] seconds. Changed your mind? [link:Go back]',
              {
                redirectUrl,
                count,
                link: <a href="#" onClick={this.goBack} />,
              }
            )}
          </AuthPanel>
        </RedirectContainer>
      </div>
    );
  }
}

const RedirectContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 5vh;
`;

const AuthPanel = styled(Panel)`
  width: 550px;
  display: inline-grid;
  grid-template-columns: 1fr;
  text-align: center;
  align-items: center;
  word-wrap: break-word;
  padding: 2rem;
`;

export default ExternalRedirect;
