import React from 'react';
// import {Link} from 'react-router';

import CSSModules from 'react-css-modules';
import styles from '../../less/components/button.css';

const Button = React.createClass({
  render() {
    return(
      <a styleName='btn btn-default'>{this.props.children}</a>
    );
  }
});

export default CSSModules(Button, styles, {allowMultiple: true} );
