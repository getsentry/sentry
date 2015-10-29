import React from "react";

const LoadingError = React.createClass({
  propTypes: {
    onRetry: React.PropTypes.func,
    message: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      message: "There was an error loading data."
    };
  },

  shouldComponentUpdate() {
    return false;
  },

  render() {
    return (
      <div className="alert alert-error alert-block">
        <p>
          {this.props.message}
          {this.props.onRetry &&
            <a onClick={this.props.onRetry} className="btn btn-sm">Retry</a>
          }
        </p>
      </div>
    );
  }
});

export default LoadingError;

