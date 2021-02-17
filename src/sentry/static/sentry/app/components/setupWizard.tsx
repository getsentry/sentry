import React from 'react';

import {Client} from 'app/api';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';

type Props = {
  api: Client;
  hash?: boolean | string;
  mobile?: boolean;
};

type State = {
  finished: boolean;
};

class SetupWizard extends React.Component<Props, State> {
  static defaultProps = {
    hash: false,
    mobile: false,
  };

  state: State = {
    finished: false,
  };

  UNSAFE_componentWillMount() {
    this.pollFinished();
  }

  pollFinished() {
    return new Promise(resolve => {
      this.props.api.request(`/wizard/${this.props.hash}/`, {
        method: 'GET',
        success: () => {
          if (this.props.mobile) {
            // On mobile we don't wait for the App to connect here
            // We just tell the user everything is alright
            this.setState({finished: true});
          } else {
            setTimeout(() => this.pollFinished(), 1000);
          }
        },
        error: () => {
          resolve();
          this.setState({finished: true});
          setTimeout(() => window.close(), 10000);
        },
      });
    });
  }

  renderSuccess() {
    return (
      <div className="row">
        <h5>{t('Return to your terminal to complete your setup')}</h5>
        <h5>{t('(This window will close in 10 seconds)')}</h5>
        <button className="btn btn-default" onClick={() => window.close()}>
          Close browser tab
        </button>
      </div>
    );
  }

  renderLoading() {
    return (
      <div className="row">
        <h5>{t('Waiting for wizard to connect')}</h5>
      </div>
    );
  }

  renderMobileSuccess() {
    return (
      <div className="row">
        <h5>{t('Return to the App')}</h5>
      </div>
    );
  }

  renderMobileLoading() {
    return (
      <div className="row">
        <h5>{t('Waiting for your App to connect')}</h5>
      </div>
    );
  }

  render() {
    const {finished} = this.state;
    const {mobile} = this.props;

    let success = this.renderSuccess;
    let loading = this.renderLoading;
    if (mobile) {
      success = this.renderMobileSuccess;
      loading = this.renderMobileLoading;
    }
    return (
      <div className="container">
        <LoadingIndicator style={{margin: '2em auto'}} finished={finished}>
          {finished ? success() : loading()}
        </LoadingIndicator>
      </div>
    );
  }
}

export default withApi(SetupWizard);
