import React from 'react';
import ApiMixin from '../../../mixins/apiMixin';

const Waiting = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      error: false,
      options: {},
      platform: ''
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData(callback) {
    this.api.request('/internal/options/?query=is:required', {
      method: 'GET',
      success: data => {
        this.setState({
          options: data,
          loading: false,
          error: false
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  next() {
    this.setState({step: this.state.step + 1});
  },

  render() {
    return (
      <div className="waiting-indicator">

        <div className="awaiting-event">
          <div className="configure-text col-sm-4">
            <h2>Configure your application</h2>
          </div>
          <div className="wrap col-sm-8">
            <span className="icon-spinner spin" />
            <div className="waiting-text"><h3>Waiting for your event</h3></div>
            <div className="robot"><span className="eye" /></div>
          </div>
        </div>

      </div>
    );
  }
});

export default Waiting;
