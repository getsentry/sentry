import React from 'react';
import Pills from '../../pills';
import Pill from '../../pill';

const ExceptionMechanism = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
    platform: React.PropTypes.string,
  },

  render() {
    let pills = [];

    if (this.props.data.mach_exception) {
      const {mach_exception} = this.props.data;
      if (mach_exception.exception_name) {
        pills.push(<Pill
          key="mach-exception"
          name="mach exception"
          value={mach_exception.exception_name}
        />);
      }
      if (mach_exception.code_name) {
        pills.push(<Pill
          key="mach-code"
          name="mach code"
          value={mach_exception.code_name}
        />);
      }
    }
    if (this.props.data.posix_signal) {
      const {posix_signal} = this.props.data;
      pills.push(<Pill
        key="signal"
        name="signal"
        >
        {posix_signal.name}
        {' '}
        <em>({posix_signal.signal})</em>
      </Pill>);
    }

    if (pills.length === 0) {
      return null;
    }

    return (
      <div className="exception-mechanism">
        <Pills>{pills}</Pills>
      </div>
    );
  }
});

export default ExceptionMechanism;
