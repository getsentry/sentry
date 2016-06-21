import React from 'react';
import Reflux from 'reflux';
import PureRenderMixin from 'react-addons-pure-render-mixin';

import AlertStore from '../stores/alertStore';
import AlertMessage from './alertMessage';

const Alerts = React.createClass({
  mixins: [
    PureRenderMixin,
    Reflux.connect(AlertStore, 'alerts')
  ],

  getInitialState() {
    return {
      alerts: []
    };
  },

  render() {
    return (
      <div {...this.props}>
        {this.state.alerts.map(function(alert) {
           return <AlertMessage alert={alert} key={alert.key} />;
        })}
      </div>
    );
  }
});

export default Alerts;
