/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");

var alertStore = require('../stores/alertStore');
var AlertMessage = require('./alertMessage');

var Alerts = React.createClass({
  mixins: [Reflux.connect(alertStore, "alerts")],

  getInitialState: function() {
      return {
          alerts: []
      };
  },

  render: function() {
    return (
      <div {...this.props}>
        {this.state.alerts.map(function(alert, key) {
           return <div key={key}>{alert}</div>;
        })}
      </div>
    );
  }
});


module.exports = Alerts;
