import React from "react";
import $ from "jquery";

var RuleNode = React.createClass({
  componentDidMount() {
    let $html = $(this.refs.html.getDOMNode());
    $html.find('select').selectize();
    $html.find('select, input, textarea').each((_, el) => {
      let $el = $(el);
      $el.val(this.props[el.name]);
    });
  },

  render() {
    let {id, node} = this.props;
    return (
      <tr>
        <td className="rule-form">
          <input type="hidden" name="id" value={id} />
          <span ref="html" dangerouslySetInnerHTML={{__html: node.html}} />
        </td>
        <td className="align-right">
          <a onClick={this.props.onDelete}>
            <span className="icon-trash" />
          </a>
        </td>
      </tr>
    );
  }
});

export default RuleNode;
