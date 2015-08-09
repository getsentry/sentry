import React from "react";
import Reflux from "reflux";
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

import AlertStore from '../stores/alertStore';
import AlertMessage from './alertMessage';

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
    var className = this.props.className;

    if (!this.state.alerts.length) {
      className += " hidden";
    } else {
      className = this.props.className;
    }

    return (
      <div className={className}>
        {this.state.alerts.map(function(alert, key) {
           return <AlertMessage id={alert.id} key={key} type={alert.type} message={alert.message} />;
        })}
      </div>
    );
  }
});

export default Alerts;
