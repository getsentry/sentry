import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import SpreadLayout from 'app/components/spreadLayout';

// Flexbox, use when you want your children to be equal sizes
const SplitLayout = ({children, className, responsive, splitWidth, ...props}) => {
  let cx = classNames('split-layout', className, {
    'allow-responsive': responsive,
  });
  let childCount = 0;
  let totalChildren = React.Children.count(children);

  return (
    <SpreadLayout {...props} className={cx}>
      {React.Children.map(children, child => {
        let childProps = (child && child.props) || {};
        childCount++;
        let isLastChild = childCount === totalChildren;

        return React.cloneElement(child, {
          style: {
            marginRight: isLastChild ? undefined : splitWidth,
            ...((child.props && child.props.style) || {}),
          },
          className: classNames(childProps.className, 'split-layout-child'),
        });
      })}
    </SpreadLayout>
  );
};

SplitLayout.propTypes = {
  children: PropTypes.node,
  /** Distance in # of pixels to separate children */
  splitWidth: PropTypes.number,
  /** Changes flex-direction to be column on smaller widths */
  responsive: PropTypes.bool,
};

export default SplitLayout;
