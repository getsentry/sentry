import React from 'react';
import classNames from 'classnames';

function LoadingIndicator(props) {
  let {mini, triangle} = props;
  let classes = {
    loading: true,
    mini,
    triangle
  };

  return (
    <div className={classNames(props.className, classes)}>
      <div className="loading-indicator"></div>
      <div className="loading-message">{props.children}</div>
    </div>
  );
}

LoadingIndicator.propTypes = {
  mini: React.PropTypes.bool,
  triangle: React.PropTypes.bool
};

export default LoadingIndicator;

