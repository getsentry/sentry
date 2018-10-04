import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Button from 'app/components/button';
import {t} from 'app/locale';
import {SelectField, NumberField, TextField} from 'app/components/forms';

class RuleNode extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    node: PropTypes.shape({
      label: PropTypes.string.isRequired,
      formFields: PropTypes.object,
    }).isRequired,
    handleDelete: PropTypes.func.isRequired,
    handlePropertyChange: PropTypes.func.isRequired,
  };

  getChoiceField(name, data) {
    // Select the first item on this list
    // If it's not yet defined, call handlePropertyChange to make sure the value is set on state

    let initialVal;
    if (this.props.data[name] === undefined && !!data.choices.length) {
      initialVal = data.choices[0][0];
      this.props.handlePropertyChange(name, initialVal);
    } else {
      initialVal = this.props.data[name];
    }

    return (
      <SelectField
        clearable={false}
        placeholder={t('Select integration')}
        noResultsText={t('No integrations available')}
        name={name}
        value={initialVal}
        choices={data.choices}
        key={name}
        style={{marginLeft: 6, marginRight: 6}}
        onChange={val => this.props.handlePropertyChange(name, val)}
      />
    );
  }

  getTextField(name, data) {
    return (
      <TextField
        name={name}
        value={this.props.data[name]}
        placeholder={data.placeholder}
        key={name}
        style={{marginBottom: 0}}
        onChange={val => this.props.handlePropertyChange(name, val)}
      />
    );
  }

  getNumberField(name, data) {
    return (
      <NumberField
        name={name}
        value={this.props.data[name]}
        placeholder={data.placeholder.toString()}
        key={name}
        style={{marginBottom: 0}}
        onChange={val => this.props.handlePropertyChange(name, val)}
      />
    );
  }

  getField(name, data) {
    const getFieldTypes = {
      choice: this.getChoiceField.bind(this),
      number: this.getNumberField.bind(this),
      string: this.getTextField.bind(this),
    };
    return getFieldTypes[data.type](name, data);
  }

  getComponent(node) {
    const {label, formFields} = node;

    return label.split(/({\w+})/).map(part => {
      if (!/^{\w+}$/.test(part)) {
        return part;
      }

      const key = part.slice(1, -1);
      return formFields[key] ? this.getField(key, formFields[key]) : part;
    });
  }

  render() {
    const {data, node} = this.props;

    const component = this.getComponent(node);

    return (
      <RuleNodeRow>
        <RuleNodeForm>
          <input type="hidden" name="id" value={data.id} />
          {component}
        </RuleNodeForm>
        <RuleNodeControls>
          <Button
            onClick={this.props.handleDelete}
            type="button"
            tabIndex="-1"
            size="small"
            icon="icon-trash"
          />
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

const RuleNodeForm = styled('div')`
  display: flex;
  flex-wrap: wrap;
  flex: 1;
  line-height: 40px;
  margin: 5px 12px 5px 0;
  align-items: center;

  .control-group {
    margin: 0 6px;
  }

  .form-control {
    padding: 3px 12px;
  }

  .Select {
    line-height: 26px;
    min-width: 150px;
  }
  .Select-placeholder {
    height: 26px;
    line-height: 26px;
  }
  .Select-control {
    height: 24px;
  }
  .Select--single > .Select-control .Select-value {
    line-height: 25px;
  }
  .Select-input {
    height: 24px;
    input {
      line-height: 20px;
      padding: 2px 0;
    }
  }
`;

const RuleNodeControls = styled.div`
  margin-left: 6px;
`;
