import React from 'react';
import ReactDOM from 'react-dom';
import $ from 'jquery';

const RuleNode = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
    node: React.PropTypes.shape({
      html: React.PropTypes.string.isRequired
    }).isRequired,
    onDelete: React.PropTypes.func.isRequired
  },

  componentDidMount() {
    let $html = $(ReactDOM.findDOMNode(this.refs.html));

    $html.find('select, input, textarea').each((_, el) => {
      let $el = $(el);
      $el.attr('id', '');
      $el.val(this.props.data[el.name]);
    });

    $html.find('select').select2();

    $html.find('input.typeahead').each((_, el) => {
      let $el = $(el);
      $el.select2({
        initSelection: function(option, callback) {
          let $option = $(option);
          callback({id: $option.val(), text: $option.val()});
        },
        data: $el.data('choices'),
        createSearchChoice: function(term) {
          return {id: $.trim(term), text: $.trim(term)};
        }
      });
    });
  },

  render() {
    let {data, node} = this.props;
    return (
      <tr>
        <td className="rule-form">
          <input type="hidden" name="id" value={data.id} />
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
