import classNames from 'classnames';
import React from 'react';

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

export default LoadingIndicator;

