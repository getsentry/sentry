/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var IndicatorStore = require('../stores/indicatorStore');

var Indicators = React.createClass({
  mixins: [
    PureRenderMixin,
    Reflux.connect(IndicatorStore, "items")
  ],

  getInitialState() {
      return {
          items: []
      };
  },

  render() {
    return (
      <div {...this.props}>
        {this.state.items.map(function(item, key) {
           return <div key={key}>{item}</div>;
        })}
      </div>
    );
  }
});

module.exports = Indicators;
