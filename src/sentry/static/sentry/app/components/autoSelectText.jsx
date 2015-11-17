import React from 'react';
import jQuery from 'jquery';
import ReactDOM from 'react-dom';

const AutoSelectText = React.createClass({
  componentDidMount() {
    let ref = ReactDOM.findDOMNode(this.refs.element);
    jQuery(ref).bind('click', this.selectText);
  },

  componentWillUnmount() {
    let ref = ReactDOM.findDOMNode(this.refs.element);
    jQuery(ref).unbind('click', this.selectText);
  },

  selectText() {
    let node = ReactDOM.findDOMNode(this.refs.element).firstChild;
    if (document.selection) {
      let range = document.body.createTextRange();
      range.moveToElementText(node);
      range.select();
    } else if (window.getSelection) {
      let range = document.createRange();
      range.selectNode(node);
      window.getSelection().addRange(range);
    }
  },

  render() {
    return (
      <div ref="element" className={this.props.className}>
        {this.props.children}
      </div>
    );
  }
});

export default AutoSelectText;
