import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import 'app/../less/components/flowLayout.less';

// Simple horizontal layout with vertical centering
// Takes up remaining space of a flexbox container (i.e. "flex: 1")
class FlowLayout extends React.Component {
  static propTypes = {
    /** Centers content via `justify-content` */
    center: PropTypes.bool,
    /** Changes flex direction to be column */
    vertical: PropTypes.bool,
    /** Applies "overflow: hidden" to container so that children can be truncated */
    truncate: PropTypes.bool,
  };

  static defaultProps = {
    truncate: true,
  };

  render() {
    let {className, children, truncate, vertical, center, ...otherProps} = this.props;
    let cx = classNames('flow-layout', className, {
      'is-vertical': vertical,
      'is-center': center,
      'is-truncated': truncate,
    });

    return (
      <div className={cx} {...otherProps}>
        {children}
      </div>
    );
  }
}

export default FlowLayout;
