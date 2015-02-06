/*** @jsx React.DOM */

var React = require("react");

var LoadingIndicator = React.createClass({
  propTypes: {
    message: React.PropTypes.string
  },

  getInitialProps() {
    return {
      message: "Loading..."
    };
  },

  render() {
    return (
      <div className="loading">
        {this.props.message}
      </div>
    );
  }
});

module.exports = LoadingIndicator;
