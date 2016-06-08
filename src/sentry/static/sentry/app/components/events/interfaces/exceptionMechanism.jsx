import React from 'react';

const ExceptionMechanism = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
    platform: React.PropTypes.string,
  },

  renderMachException(data) {
    return (
      <p>
        <strong>Mach Exception</strong>: <code>{data.exception_name} ({data.exception})</code>
      </p>
    );
  },

  renderPosixSignal(data) {
    return (
      <p>
        <strong>Posix Signal</strong>: <code>{data.name} ({data.signal})</code>
      </p>
    );
  },

  render() {
    let elements = [];

    if (this.props.data.mach_exception) {
      elements.push(this.renderMachException(this.props.data.mach_exception));
    }
    if (this.props.data.posix_signal) {
      elements.push(this.renderPosixSignal(this.props.data.posix_signal));
    }

    if (elements.length === 0) {
      return null;
    }

    return (
      <div className="exception-mechanism">
        <ul>{elements.map((item, idx) => {
          return <li key={idx}>{item}</li>;
        })}</ul>
      </div>
    );
  }
});

export default ExceptionMechanism;
