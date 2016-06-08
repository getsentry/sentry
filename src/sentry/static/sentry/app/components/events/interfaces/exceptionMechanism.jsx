import React from 'react';
import KeyValueList from '../interfaces/keyValueList';

const ExceptionMechanism = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
    platform: React.PropTypes.string,
  },

  renderMachException(data) {
    return ['Mach Exception', data.exception_name];
  },

  renderPosixSignal(data) {
    return ['Signal', data.name + ' (' + data.signal + ')'];
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
        <KeyValueList data={elements} />
      </div>
    );
  }
});

export default ExceptionMechanism;
