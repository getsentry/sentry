import React from 'react';
import 'style-loader!./style.less';

const Button = React.createClass({
  render() {
    return <button className="special-button">{this.props.children}</button>;
  }
});

export default Button;
