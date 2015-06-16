var React = require("react");
var Reflux = require("reflux");
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var AlertStore = require('../stores/alertStore');

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

module.exports = Alerts;
