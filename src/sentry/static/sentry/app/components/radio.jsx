import React from 'react';
import classNames from 'classnames';

const Radio = React.createClass({
  getDefaultProps() {
    return {
      checked: false
    };
  },

  render() {
    let {className, ...otherProps} = this.props;
    let cx = classNames('radio-select', className);
    return <input type="radio" className={cx} {...otherProps} />;
  }
});

export default Radio;
