import React, {PropTypes} from 'react';
import classNames from 'classnames';

// Flexbox container whose children will have `justify-content: space-between`
//
// Intended for children.length == 2
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
