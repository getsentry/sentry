import React from 'react';

class Checkbox extends React.Component {
  static defaultProps = {
    checked: false,
  };

  render() {
    return <input type="checkbox" {...this.props} />;
  }
}

export default Checkbox;
