import classNames from 'classnames';
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
  type: React.PropTypes.string.isRequired
};

export default ToastIndicator;
