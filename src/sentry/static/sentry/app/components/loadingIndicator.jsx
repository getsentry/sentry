import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

function LoadingIndicator(props) {
  let {mini, triangle, children, finished, className, style} = props;
  let cx = classNames(className, {
    loading: true,
    mini,
    triangle,
  });

  let loadingCx = classNames({
    'loading-indicator': true,
    'load-complete': finished,
  });

  return (
    <div className={cx} style={style}>
      <div className={loadingCx}>
        {finished ? <div className="checkmark draw" /> : null}
      </div>

      <div className="loading-message">{children}</div>
    </div>
  );
}

LoadingIndicator.propTypes = {
  mini: PropTypes.bool,
  triangle: PropTypes.bool,
  finished: PropTypes.bool,
};

export default LoadingIndicator;
