import React from 'react';
import classNames from 'classnames';

class Radio extends React.Component {
  static defaultProps = {
    checked: false,
  };

  render() {
    let {className, ...otherProps} = this.props;
    let cx = classNames('radio-select', className);
    return <input type="radio" className={cx} {...otherProps} />;
  }
}

export default Radio;
