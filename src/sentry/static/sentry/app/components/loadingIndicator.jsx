/*** @jsx React.DOM */
var joinClasses = require("react/lib/joinClasses");
var classSet = require("react/lib/cx");
var React = require("react");

var LoadingIndicator = React.createClass({
  propTypes: {
    message: React.PropTypes.string,
    mini:  React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      message: "Loading..."
    };
  },

  shouldComponentUpdate() {
    return false;
  },

  render() {
    var className = classSet({
      "loading": true,
      "mini": this.props.mini,
    });

    return (
      <div className={joinClasses(this.props.className, className)}>
        <div className="loading-indicator"></div>
        <div className="loading-message">{this.props.message}</div>
      </div>
    );
  }
});

module.exports = LoadingIndicator;
