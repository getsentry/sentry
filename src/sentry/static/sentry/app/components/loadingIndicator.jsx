import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

function LoadingIndicator(props) {
  let {
    hideMessage,
    mini,
    triangle,
    overlay,
    dark,
    children,
    finished,
    className,
    style,
    relative,
    size,
  } = props;
  let cx = classNames(className, {
    overlay,
    dark,
    loading: true,
    mini,
    triangle,
  });

  let loadingCx = classNames({
    relative,
    'loading-indicator': true,
    'load-complete': finished,
  });

  let loadingStyle = {};
  if (size) {
    loadingStyle = {
      width: size,
      height: size,
    };
  }

  return (
    <div className={cx} style={style}>
      <div className={loadingCx} style={loadingStyle}>
        {finished ? <div className="checkmark draw" /> : null}
      </div>

      {!hideMessage && <div className="loading-message">{children}</div>}
    </div>
  );
}

LoadingIndicator.propTypes = {
  overlay: PropTypes.bool,
  dark: PropTypes.bool,
  mini: PropTypes.bool,
  triangle: PropTypes.bool,
  finished: PropTypes.bool,
  relative: PropTypes.bool,
  hideMessage: PropTypes.bool,
  size: PropTypes.number,
};

export default LoadingIndicator;
