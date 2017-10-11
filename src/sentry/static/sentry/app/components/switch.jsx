import PropTypes from 'prop-types';
import React from 'react';

const Switch = React.createClass({
  propTypes: {
    id: PropTypes.string,
    size: PropTypes.string,
    isActive: PropTypes.bool,
    isLoading: PropTypes.bool,
    isDisabled: PropTypes.bool,
    toggle: PropTypes.func.isRequired,
  },

  render() {
    let switchClasses = 'switch';
    let {size, isActive, isLoading, isDisabled, toggle, id} = this.props;

    if (size) {
      switchClasses += ' switch-' + size;
    }

    if (isActive) {
      switchClasses += ' switch-on';
    }

    if (isLoading) {
      switchClasses += ' switch-changing';
    }

    if (isDisabled) {
      switchClasses += ' switch-disabled';
    }

    return (
      <div
        id={id}
        className={switchClasses}
        onClick={isDisabled ? null : toggle}
        role="checkbox"
        aria-checked={isActive}
      >
        <span className="switch-toggle" />
      </div>
    );
  },
});

export default Switch;
