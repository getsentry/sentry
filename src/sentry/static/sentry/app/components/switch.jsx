import PropTypes from 'prop-types';
import React from 'react';

const Switch = React.createClass({
  propTypes: {
    size: PropTypes.string,
    isActive: PropTypes.bool,
    isLoading: PropTypes.bool,
    isDisabled: PropTypes.bool,
    toggle: PropTypes.func.isRequired
  },

  render() {
    let switchClasses = 'switch';

    if (this.props.size) {
      switchClasses += ' switch-' + this.props.size;
    }

    if (this.props.isActive) {
      switchClasses += ' switch-on';
    }

    if (this.props.isLoading) {
      switchClasses += ' switch-changing';
    }

    if (this.props.isDisabled) {
      switchClasses += ' switch-disabled';
    }

    return (
      <div
        className={switchClasses}
        onClick={this.props.isDisabled ? null : this.props.toggle}
        role="checkbox"
        aria-checked={this.props.isActive}>
        <span className="switch-toggle" />
      </div>
    );
  }
});

export default Switch;
