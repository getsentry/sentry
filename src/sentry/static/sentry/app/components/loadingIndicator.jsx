/*** @jsx React.DOM */
var joinClasses = require("react/lib/joinClasses");
var classSet = require("react/lib/cx");
var React = require("react");

var LoadingIndicator = React.createClass({
  propTypes: {
    global: React.PropTypes.bool,
    mini:  React.PropTypes.bool
  },

  shouldComponentUpdate() {
    return false;
  },

  render() {
    var className = classSet({
      "loading": true,
      "mini": this.props.mini,
      "global": this.props.global,
    });

    return (
      <div className={joinClasses(this.props.className, className)}>
        <div className="loading-mask"></div>
        <div className="loading-indicator"></div>
        <div className="loading-message">{this.props.children}</div>
      </div>
    );
  }
});

module.exports = LoadingIndicator;
