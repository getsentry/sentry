import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

function ToastIndicator({type, children}) {
  return (
    <div className={classNames('toast', type)}>
      <span className="icon" />
      <div className="toast-message">{children}</div>
    </div>
  );
}

ToastIndicator.propTypes = {
  type: PropTypes.string.isRequired
};

export default ToastIndicator;
