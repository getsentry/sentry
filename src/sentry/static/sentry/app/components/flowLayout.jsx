import React from 'react';
import classNames from 'classnames';
import '../../less/components/flowLayout.less';

// Simple horizontal layout with vertical centering
const FlowLayout = React.createClass({
  propTypes: {},

  getDefaultProps() {
    return {};
  },

  render() {
    let {className, children, ...otherProps} = this.props;
    let cx = classNames('flow-layout', className);

    return (
      <div className={cx} {...otherProps}>
        {children}
      </div>
    );
  }
});

export default FlowLayout;
