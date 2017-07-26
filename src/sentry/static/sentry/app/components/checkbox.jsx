import React from 'react';

const Checkbox = React.createClass({
  getDefaultProps() {
    return {
      checked: false
    };
  },

  render() {
    return <input type="checkbox" className="chk-select" {...this.props} />;
  }
});

export default Checkbox;
