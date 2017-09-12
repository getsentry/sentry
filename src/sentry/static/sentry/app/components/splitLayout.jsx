import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import SpreadLayout from './spreadLayout';

// Flexbox, use when you want your children to be equal sizes
const SplitLayout = ({children, className, responsive, ...props}) => {
  const cx = classNames('split-layout', className, {
    'allow-responsive': responsive
  });

  return (
    <SpreadLayout {...props} className={cx}>
      {React.Children.map(children, child => {
        const childProps = (child && child.props) || {};
        return React.cloneElement(child, {
          className: classNames(childProps.className, 'split-layout-child')
        });
      })}
    </SpreadLayout>
  );
};

SplitLayout.propTypes = {
  children: PropTypes.node,
  responsive: PropTypes.bool
};

export default SplitLayout;
