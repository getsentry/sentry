import React from 'react';
import styled from 'react-emotion';

import {
  IssueAlertRuleAction,
  IssueAlertRuleActionTemplate,
  IssueAlertRuleCondition,
  IssueAlertRuleConditionTemplate,
} from 'app/types/alerts';
import {t} from 'app/locale';
import Button from 'app/components/button';
import Input from 'app/views/settings/components/forms/controls/input';
import SelectControl from 'app/components/forms/selectControl';
import space from 'app/styles/space';

type FormField = {
  // Type of form fields
  type: string;
  // The rest is configuration for the form field
  [key: string]: any;
};

type Props = {
  node?: IssueAlertRuleActionTemplate | IssueAlertRuleConditionTemplate | null;
  data?: IssueAlertRuleAction | IssueAlertRuleCondition;
  onDelete: () => void;
  onPropertyChange: (name: string, value: string) => void;
};

class RuleNode extends React.Component<Props> {
  getChoiceField = (name: string, fieldConfig: FormField) => {
    // Select the first item on this list
    // If it's not yet defined, call onPropertyChange to make sure the value is set on state
    const {data, onPropertyChange} = this.props;
    let initialVal;

    if (data) {
      if (data[name] === undefined && !!fieldConfig.choices.length) {
        if (fieldConfig.initial) {
          initialVal = fieldConfig.initial;
        } else {
          initialVal = fieldConfig.choices[0][0];
        }
        onPropertyChange(name, initialVal);
      } else {
        initialVal = data[name];
      }
    }

    return (
      <SelectWrapper>
        <SelectControl
          clearable={false}
          placeholder={t('Select integration')}
          noResultsText={t('No integrations available')}
          height="35"
          name={name}
          value={initialVal}
          choices={fieldConfig.choices}
          key={name}
          onChange={val => this.props.onPropertyChange(name, val)}
        />
      </SelectWrapper>
    );
  };

  getTextField = (name: string, fieldConfig: FormField) => {
    const {data, onPropertyChange} = this.props;

    return (
      <InlineInput
        type="text"
        name={name}
        value={data && data[name]}
        placeholder={`${fieldConfig.placeholder}`}
        key={name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onPropertyChange(name, e.target.value)
        }
      />
    );
  };

  getNumberField = (name: string, fieldConfig: FormField) => {
    const {data, onPropertyChange} = this.props;

    return (
      <InlineInput
        type="number"
        name={name}
        value={data && data[name]}
        placeholder={`${fieldConfig.placeholder}`}
        key={name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onPropertyChange(name, e.target.value)
        }
      />
    );
  };

  getField = (name: string, fieldConfig: FormField) => {
    const getFieldTypes = {
      choice: this.getChoiceField,
      number: this.getNumberField,
      string: this.getTextField,
    };
    return getFieldTypes[fieldConfig.type](name, fieldConfig);
  };

  getComponent() {
    const {data, node} = this.props;

    if (!node) {
      return null;
    }

    const {label, formFields} = node;

    const parts = label.split(/({\w+})/).map(part => {
      if (!/^{\w+}$/.test(part)) {
        return part;
      }

      const key = part.slice(1, -1);

      // If matcher is "is set" or "is not set", then we do not want to show the value input
      // because it is not required
      if (key === 'value' && (data && (data.match === 'is' || data.match === 'ns'))) {
        return null;
      }

      return formFields && formFields.hasOwnProperty(key)
        ? this.getField(key, formFields[key])
        : part;
    });

    const [title, ...inputs] = parts;

    // We return this so that it can be a grid
    return (
      <React.Fragment>
        <div>{title}</div>
        <RuleNodeForm>{inputs}</RuleNodeForm>
      </React.Fragment>
    );
  }

  render() {
    const {data, onDelete} = this.props;

    const component = this.getComponent();

    return (
      <React.Fragment>
        {data && <input type="hidden" name="id" value={data.id} />}
        {component}
        <div>
          <Button onClick={onDelete} type="button" size="small" icon="icon-trash" />
        </div>
      </React.Fragment>
    );
  }
}

export default RuleNode;

const SelectWrapper = styled('div')`
  width: 204px;
`;

const InlineInput = styled(Input)`
  width: auto;
`;

const RuleNodeForm = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  grid-auto-flow: column;
  grid-auto-columns: min-content;
  align-items: center;
  white-space: nowrap;
`;
