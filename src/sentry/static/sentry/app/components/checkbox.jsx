import React from 'react';
import classNames from 'classnames';

class Checkbox extends React.Component {
  static defaultProps = {
    checked: false,
  };

  render() {
    const {className, ...otherProps} = this.props;
    const cx = classNames('chk-select', className);
    return <input type="checkbox" className={cx} {...otherProps} />;
  }
}

export default Checkbox;
