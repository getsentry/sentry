import React from 'react';
import classNames from 'classnames';
import 'app/../less/components/toolbar.less';

const Toolbar = ({className, children, ...otherProps}) => {
  let cx = classNames('toolbar', className);

  return (
    <div className={cx} {...otherProps}>
      {children}
    </div>
  );
};

export default Toolbar;
