import React from "react";
import $ from "jquery";

var RuleNode = React.createClass({
  componentDidMount() {
    $(this.refs.html.getDOMNode()).find('select').selectize();
  },

  render() {
    var {id, node} = this.props;
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
