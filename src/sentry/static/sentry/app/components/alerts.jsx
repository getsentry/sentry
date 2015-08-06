import React from "react";
import Reflux from "reflux";
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

import AlertStore from '../stores/alertStore';

var Alerts = React.createClass({
  mixins: [
    PureRenderMixin,
    Reflux.connect(AlertStore, "alerts")
  ],

  getInitialState() {
      return {
          alerts: []
      };
  },

  render() {
    return (
      <div {...this.props}>
        {this.state.alerts.map(function(alert, key) {
           return <div key={key}>{alert}</div>;
        })}
      </div>
    );
  }
});

export default Alerts;

