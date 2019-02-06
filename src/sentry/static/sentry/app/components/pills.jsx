import React from 'react';
import classNames from 'classnames';

class Pills extends React.Component {
  render() {
    const {className, children, ...otherProps} = this.props;
    return (
      <div className={classNames('pills', className)} {...otherProps}>
        {children}
      </div>
    );
  }
}

export default Pills;
