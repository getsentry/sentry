import React from 'react';
import classNames from 'classnames';

class Radio extends React.Component {
  static defaultProps = {
    checked: false,
  };

  render() {
    const {className, ...otherProps} = this.props;
    const cx = classNames('radio-select', className);
    return <input type="radio" className={cx} {...otherProps} />;
  }
}

export default Radio;
