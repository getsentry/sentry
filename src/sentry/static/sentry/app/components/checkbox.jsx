import React from 'react';
import classNames from 'classnames';

const Checkbox = React.createClass({
  getDefaultProps() {
    return {
      checked: false
    };
  },

  render() {
    let {className, ...otherProps} = this.props;
    let cx = classNames('chk-select', className);
    return <input type="checkbox" className={cx} {...otherProps} />;
  }
});

export default Checkbox;
