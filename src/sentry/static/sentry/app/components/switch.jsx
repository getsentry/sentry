import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

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
    let {size, isActive, isLoading, isDisabled, toggle, id} = this.props;
    let switchClasses = classNames('switch', {
      [`switch-${size}`]: size,
      'switch-on': isActive,
      'switch-changing': isLoading,
      'switch-disabled': isDisabled,
    });

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
