import React from 'react';
import classNames from 'classnames';

type DefaultProps = {
  checked: boolean;
};

class Radio extends React.Component<React.HTMLProps<HTMLInputElement> & DefaultProps> {
  static defaultProps: DefaultProps = {
    checked: false,
  };

  render() {
    const {className, ...otherProps} = this.props;
    const cx = classNames('radio-select', className);
    return <input type="radio" className={cx} {...otherProps} />;
  }
}

export default Radio;
