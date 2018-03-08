import PropTypes from 'prop-types';
import React from 'react';
import {Select2Field, NumberField, TextField} from '../../components/forms';

class RuleNode extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    node: PropTypes.shape({
      label: PropTypes.string.isRequired,
      formFields: PropTypes.object,
    }).isRequired,
    onDelete: PropTypes.func.isRequired,
    handlePropertyChange: PropTypes.func.isRequired,
  };

  getChoiceField(name, data) {
    // Select the first item on this list
    // If it's not yet defined, call handlePropertyChange to make sure the value is set on state

    let initialVal;
    if (this.props.data[name] === undefined) {
      initialVal = data.choices[0][0];
      this.props.handlePropertyChange(name, initialVal);
    } else {
      initialVal = this.props.data[name];
    }

    return (
      <Select2Field
        name={name}
        value={initialVal}
        choices={data.choices}
        key={name}
        style={{marginBottom: 0}}
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
    let {data, node} = this.props;
    let html = this.getComponent(node);

    return (
      <tr>
        <td className="rule-form">
          <input type="hidden" name="id" value={data.id} />
          <span style={{display: 'flex', alignItems: 'center'}}>{html}</span>
        </td>
        <td className="align-right">
          <a onClick={this.props.onDelete}>
            <span className="icon-trash" />
          </a>
        </td>
      </tr>
    );
  }
}

export default RuleNode;
