import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

function LoadingIndicator(props) {
  let {mini, triangle, children, className} = props;
  let cx = classNames(className, {
    loading: true,
    mini,
    triangle
  });

  return (
    <div className={cx}>
      <div className="loading-indicator" />

      <div className="loading-message">{children}</div>
    </div>
  );
}

LoadingIndicator.propTypes = {
  mini: PropTypes.bool,
  triangle: PropTypes.bool
};

export default LoadingIndicator;
