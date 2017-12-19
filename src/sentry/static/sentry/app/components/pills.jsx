import React from 'react';
import classNames from 'classnames';

class Pills extends React.Component {
  render() {
    let {className, children, ...otherProps} = this.props;
    return (
      <div className={classNames('pills', className)} {...otherProps}>
        {children}
      </div>
    );
  }
}

export default Pills;
