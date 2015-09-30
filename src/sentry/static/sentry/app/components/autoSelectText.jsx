import jQuery from "jquery";
import React from "react";

const AutoSelectText = React.createClass({
  componentDidMount() {
    let ref = this.refs.element.getDOMNode();
    jQuery(ref).bind('click', this.selectText);
  },

  componentWillUnount() {
    let ref = this.refs.element.getDOMNode();
    jQuery(ref).unbind('click', this.selectText);
  },

  selectText() {
    var node = this.refs.element.getDOMNode().firstChild;
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
