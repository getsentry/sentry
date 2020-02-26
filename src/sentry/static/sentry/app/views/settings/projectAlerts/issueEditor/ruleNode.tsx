import React from 'react';
import styled from '@emotion/styled';

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
  index: number;
  node?: IssueAlertRuleActionTemplate | IssueAlertRuleConditionTemplate | null;
  data?: IssueAlertRuleAction | IssueAlertRuleCondition;
  onDelete: (rowIndex: number) => void;
  onPropertyChange: (rowIndex: number, name: string, value: string) => void;
};

class RuleNode extends React.Component<Props> {
  handleDelete = () => {
    const {index, onDelete} = this.props;
    onDelete(index);
  };

  getChoiceField = (name: string, fieldConfig: FormField) => {
    // Select the first item on this list
    // If it's not yet defined, call onPropertyChange to make sure the value is set on state
    const {data, index, onPropertyChange} = this.props;
    let initialVal;

    if (data) {
      if (data[name] === undefined && !!fieldConfig.choices.length) {
        if (fieldConfig.initial) {
          initialVal = fieldConfig.initial;
        } else {
          initialVal = fieldConfig.choices[0][0];
        }
      } else {
        initialVal = data[name];
      }
    }

    // Cast `key` to string, this problem pops up because of react-select v3 where
    // `value` requires the `option` object (e.g. {label, object}) - we have
    // helpers in `SelectControl` to filter `choices` to produce the value object
    //
    // However there are integrations that give the form field choices with the value as number, but
    // when the integration configuration gets saved, it gets saved and returned as a string
    const choices = fieldConfig.choices.map(([key, value]) => [`${key}`, value]);

    return (
      <InlineSelectControl
        isClearable={false}
        name={name}
        value={initialVal}
        styles={{
          control: provided => ({
            ...provided,
            minHeight: '28px',
            height: '28px',
          }),
        }}
        choices={choices}
        onChange={({value}) => onPropertyChange(index, name, value)}
      />
    );
  };

  getTextField = (name: string, fieldConfig: FormField) => {
    const {data, index, onPropertyChange} = this.props;

    return (
      <InlineInput
        type="text"
        name={name}
        value={(data && data[name]) ?? ''}
        placeholder={`${fieldConfig.placeholder}`}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onPropertyChange(index, name, e.target.value)
        }
      />
    );
  };

  getNumberField = (name: string, fieldConfig: FormField) => {
    const {data, index, onPropertyChange} = this.props;

    return (
      <InlineInput
        type="number"
        name={name}
        value={(data && data[name]) ?? ''}
        placeholder={`${fieldConfig.placeholder}`}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onPropertyChange(index, name, e.target.value)
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

  renderRow() {
    const {data, node} = this.props;

    if (!node) {
      return null;
    }

    const {label, formFields} = node;

    const parts = label.split(/({\w+})/).map((part, i) => {
      if (!/^{\w+}$/.test(part)) {
        return <Separator key={i}>{part}</Separator>;
      }

      const key = part.slice(1, -1);

      // If matcher is "is set" or "is not set", then we do not want to show the value input
      // because it is not required
      if (key === 'value' && data && (data.match === 'is' || data.match === 'ns')) {
        return null;
      }

      return (
        <Separator key={key}>
          {formFields && formFields.hasOwnProperty(key)
            ? this.getField(key, formFields[key])
            : part}
        </Separator>
      );
    });

    const [title, ...inputs] = parts;

    // We return this so that it can be a grid
    return (
      <Rule>
        {title}
        {inputs}
      </Rule>
    );
  }

  render() {
    const {data} = this.props;

    return (
      <RuleRow>
        {data && <input type="hidden" name="id" value={data.id} />}
        {this.renderRow()}
        <DeleteButton
          label={t('Delete Node')}
          onClick={this.handleDelete}
          type="button"
          size="small"
          icon="icon-trash"
        />
      </RuleRow>
    );
  }
}

export default RuleNode;

const InlineInput = styled(Input)`
  width: auto;
  height: 28px;
`;

const InlineSelectControl = styled(SelectControl)`
  width: 180px;
`;

const Separator = styled('span')`
  margin-right: ${space(1)};
  padding-top: ${space(0.5)};
  padding-bottom: ${space(0.5)};
`;

const RuleRow = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)};

  &:nth-child(odd) {
    background-color: ${p => p.theme.offWhite};
  }
`;

const Rule = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
  flex-wrap: wrap;
`;

const DeleteButton = styled(Button)`
  flex-shrink: 0;
`;
