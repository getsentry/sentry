import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import styled, {cx} from 'react-emotion';
import $ from 'jquery';
import Button from '../../components/buttons/button';

class RuleNode extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    node: PropTypes.shape({
      html: PropTypes.string.isRequired,
    }).isRequired,
    onDelete: PropTypes.func.isRequired,
  };

  componentDidMount() {
    let $html = $(ReactDOM.findDOMNode(this.refs.html));

    $html.find('select, input, textarea').each((_, el) => {
      if (this.props.data[el.name] === undefined) {
        return;
      }

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
        },
      });
    });
  }

  render() {
    let {data, node} = this.props;
    return (
      <RuleNodeRow>
        <RuleNodeForm>
          <input type="hidden" name="id" value={data.id} />
          <span ref="html" dangerouslySetInnerHTML={{__html: node.html}} />
        </RuleNodeForm>
        <RuleNodeControls>
          <Button onClick={this.props.onDelete} type="button" tabIndex="-1" size="small">
            <span className="icon icon-trash" />
          </Button>
        </RuleNodeControls>
      </RuleNodeRow>
    );
  }
}

export default RuleNode;

const RuleNodeRow = styled.div`
  display: flex;
  align-items: center;
  padding: 0 15px;

  &:nth-child(odd) {
    background-color: ${p => p.theme.offWhite};
  }
`;

// This needs to have class name "rule-form" because of how we serialize rules atm
const RuleNodeForm = styled(({className, ...props}) => (
  <div {...props} className={cx(className, 'rule-form')} />
))`
  display: flex;
  flex: 1;
  line-height: 36px;
  margin: 5px 0;

  .select2-container {
    margin: 0 6px;
  }

  input[type='text'],
  input[type='number'] {
    box-shadow: inset 0 2px 0 rgba(0, 0, 0, 0.04);
    border: 1px solid #c9c0d1;
    position: relative;
    border-radius: 3px;
    color: #493e54;
    padding: 1px 8px 2px; // select2 height = 29px
    line-height: 1.5;
    margin: 0 6px;
  }

  span {
    flex: 1;
  }
`;

const RuleNodeControls = styled.div`
  margin-left: 6px;
`;
