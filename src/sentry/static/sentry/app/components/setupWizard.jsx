import PropTypes from 'prop-types';
import React from 'react';

import {Client} from 'app/api';
import LoadingIndicator from 'app/components/loadingIndicator';

class SetupWizard extends React.Component {
  static propTypes = {
    hash: PropTypes.string.isRequired,
  };

  static defaultProps = {
    hash: false,
  };

  constructor(props, context) {
    super(props, context);

    this.state = this.getDefaultState();
  }

  UNSAFE_componentWillMount() {
    this.api = new Client();
    this.pollFinished();
  }

  getDefaultState() {
    return {
      log: [],
      finished: false,
    };
  }

  pollFinished() {
    return new Promise(resolve => {
      this.api.request(`/wizard/${this.props.hash}/`, {
        method: 'GET',
        success: () => {
          setTimeout(() => this.pollFinished(), 1000);
        },
        error: () => {
          resolve();
          this.setState({
            finished: true,
          });
          setTimeout(() => window.close(), 10000);
        },
      });
    });
  }

  renderSuccess() {
    return (
      <div className="row">
        <h5>Return to your terminal to complete your setup</h5>
        <h5>(This window will close in 10 sec)</h5>
        <button className="btn btn-default" onClick={() => window.close()}>
          Close browser tab
        </button>
      </div>
    );
  }

  renderLoading() {
    return (
      <div className="row">
        <h5>Waiting for wizard to connect</h5>
      </div>
    );
  }

  render() {
    return (
      <div className="container">
        <LoadingIndicator style={{margin: '2em auto'}} finished={this.state.finished}>
          {this.state.finished ? this.renderSuccess() : this.renderLoading()}
        </LoadingIndicator>
      </div>
    );
  }
}

export default SetupWizard;
