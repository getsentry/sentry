import React from 'react';
import ApiMixin from '../../../mixins/apiMixin';

const Waiting = React.createClass({
  propTypes: {
    skip: React.PropTypes.func
  },

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
      <div className="awaiting-event">
        <div className="pull-right">
          <div className="btn btn-primary" onClick={this.props.skip}>All done!</div>
        </div>
        <div className="wrap waiting-text">
          <h3 className="animated-ellipsis">Waiting on events to devour</h3>
          <div className="robot">
            <span className="eye" />
          </div>
        </div>
      </div>
    );
  }
});

export default Waiting;
