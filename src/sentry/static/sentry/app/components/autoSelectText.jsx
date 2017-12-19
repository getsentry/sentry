import React from 'react';
import ReactDOM from 'react-dom';
import jQuery from 'jquery';

import {selectText} from '../utils/selectText';

class AutoSelectText extends React.Component {
  componentDidMount() {
    let ref = ReactDOM.findDOMNode(this.refs.element);
    jQuery(ref).bind('click', this.selectText);
  }

  componentWillUnmount() {
    let ref = ReactDOM.findDOMNode(this.refs.element);
    jQuery(ref).unbind('click', this.selectText);
  }

  selectText = () => {
    let node = ReactDOM.findDOMNode(this.refs.element).firstChild;
    selectText(node);
  };

  render() {
    let {className, children, style} = this.props;

    return (
      <div ref="element" className={className} style={style}>
        {children}
      </div>
    );
  }
}

export default AutoSelectText;
