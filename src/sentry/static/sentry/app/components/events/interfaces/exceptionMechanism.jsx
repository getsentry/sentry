import React from 'react';
import KeyValueList from '../interfaces/keyValueList';
import {defined} from '../../../utils';

const ExceptionMechanism = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
    platform: React.PropTypes.string,
  },

  render() {
    let elements = [];

    if (this.props.data.mach_exception) {
      const {mach_exception} = this.props.data;
      if (mach_exception.exception_name) {
        elements.push(['Mach Exception', mach_exception.exception_name]);
      } else if (defined(mach_exception.exception)) {
        elements.push(['Mach Exception', '#' + mach_exception.exception]);
      }
      if (mach_exception.code_name) {
        elements.push(['Mach Code', mach_exception.code_name]);
      } else if (mach_exception.code) {
        elements.push(['Mach Code', '#' + mach_exception.code]);
      }
    }
    if (this.props.data.posix_signal) {
      const {posix_signal} = this.props.data;
      elements.push(['Signal', posix_signal.name + ' (' + posix_signal.signal + ')']);
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
