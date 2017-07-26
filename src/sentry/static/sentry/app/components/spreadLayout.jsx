import React, {PropTypes} from 'react';
import classNames from 'classnames';

const SpreadLayout = ({children, className, ...props}) => {
  const cx = classNames(className, 'spread-layout', {});
  return (
    <div {...props} className={cx}>
      {children}
    </div>
  );
};

SpreadLayout.propTypes = {
  children: PropTypes.node,
  style: PropTypes.object,
  className: PropTypes.string
};

export default SpreadLayout;
