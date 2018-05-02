import React from 'react';
import classNames from 'classnames';
import 'app/../less/components/toolbarHeader.less';

const ToolbarHeader = ({className, children, ...otherProps}) => {
  let cx = classNames('toolbar-header', className);

  return (
    <div className={cx} {...otherProps}>
      {children}
    </div>
  );
};

export default ToolbarHeader;
