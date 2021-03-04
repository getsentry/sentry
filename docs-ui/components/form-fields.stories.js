import React from 'react';
import {action} from '@storybook/addon-actions';

import {Panel} from 'app/components/panels';
import Switch from 'app/components/switchButton';
import NewBooleanField from 'app/views/settings/components/forms/booleanField';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';
import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';
import DatePickerField from 'app/views/settings/components/forms/datePickerField';
import Form from 'app/views/settings/components/forms/form';
import FormField from 'app/views/settings/components/forms/formField';
import RadioBooleanField from 'app/views/settings/components/forms/radioBooleanField';
import RadioField from 'app/views/settings/components/forms/radioField';
import SelectField from 'app/views/settings/components/forms/selectField';
import TextareaField from 'app/views/settings/components/forms/textareaField';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import TextField from 'app/views/settings/components/forms/textField';

export default {
  title: 'Forms/Fields',
};

export const _TextField = () => (
  <Panel>
    <Form initialData={{context: {location: 'cat'}}}>
      <TextField
        name="simpletextfieldvalue"
        label="Simple Text Field with Value"
        placeholder="Simple Text Field"
        defaultValue="With a value present"
      />
      <TextField
        name="simpletextfieldplaceholder"
        label="Simple Text Field with Placeholder"
        placeholder="This is placeholder text"
      />
      <TextField
        name="simpletextfieldvaluedisabled"
        label="Disabled - Simple Text Field with Value"
        placeholder="Simple Text Field"
        defaultValue="With a value present"
        disabled
      />
      <TextField
        name="simpletextfieldplaceholderdisabled"
        label="Disabled - Simple Text Field with Placeholder"
        placeholder="This is placeholder text in a disabled field"
        disabled
      />
      <TextField
        name="textfieldwithreturnsubmit"
        label="Text Field With Return Submit"
        placeholder="Type here to show the return button"
        showReturnButton
      />
      <TextField
        name="textfieldflexiblecontrol"
        label="Text Field With Flexible Control State Size"
        placeholder="Type text and then delete it"
        required
        flexibleControlStateSize
      />
      <TextField
        name="textfielddisabled"
        label="Text field with disabled reason"
        placeholder="I am disabled"
        disabled
        disabledReason="This is the reason this field is disabled"
      />
    </Form>
  </Panel>
);

_TextField.storyName = 'TextField';
_TextField.parameters = {
  docs: {
    description: {
      story: 'Simple text field',
    },
  },
};

export const _TextareaField = ({autosize, rows}) => (
  <Panel>
    <Form initialData={{context: {location: 'cat'}}}>
      <TextareaField
        name="simpletextfieldvalue"
        label="Simple Textarea Field with Value"
        help="Additional help text"
        placeholder="Simple Textarea Field"
        defaultValue="With a value present"
      />
      <TextareaField
        name="simpletextfieldautosize"
        autosize={autosize}
        label="Textarea field with autosize"
        rows={rows}
        placeholder="Use knobs to control rows and autosize setting"
      />
      <TextareaField
        name="simpletextfieldvaluedisabled"
        label="Disabled - Simple Textarea Field with Value"
        placeholder="Simple Textarea Field"
        defaultValue="With a value present"
        disabled
      />
      <TextareaField
        name="simpletextfieldplaceholderdisabled"
        label="Disabled - Simple Textarea Field with Placeholder"
        placeholder="This is placeholder text in a disabled field"
        disabled
      />
      <TextareaField
        name="textfieldwithreturnsubmit"
        label="Textarea Field With Return Submit"
        placeholder="Type here to show the return button"
        showReturnButton
      />
      <TextareaField
        name="textfieldflexiblecontrol"
        label="Textarea Field With Flexible Control State Size"
        placeholder="Type text and then delete it"
        required
        flexibleControlStateSize
      />
      <TextareaField
        name="textfielddisabled"
        label="Textarea Field with disabled reason"
        placeholder="I am disabled"
        disabled
        disabledReason="This is the reason this field is disabled"
      />
      <TextareaField
        name="textareafielderror"
        label="Textarea Field with error"
        placeholder="I have an error"
        error="An error has occurred"
      />
    </Form>
  </Panel>
);

_TextareaField.storyName = 'TextareaField';
_TextareaField.args = {
  autosize: true,
  rows: 2,
};

export const __BooleanField = () => (
  <Form>
    <NewBooleanField name="field" label="New Boolean Field" />
  </Form>
);

__BooleanField.storyName = 'BooleanField';

export const _DatePickerField = () => (
  <Form>
    <DatePickerField name="field" label="Date Picker Field" />
  </Form>
);

_DatePickerField.storyName = 'DatePickerField';

export const _RadioField = () => (
  <Form>
    <RadioField
      name="radio"
      label="Radio Field"
      choices={[
        ['choice_one', 'Choice One'],
        ['choice_two', 'Choice Two'],
        ['choice_three', 'Choice Three'],
      ]}
    />
    <RadioField
      orientInline
      name="inline-radio"
      label="Inline Radios"
      choices={[
        ['choice_one', 'Choice One'],
        ['choice_two', 'Choice Two'],
      ]}
    />
  </Form>
);

_RadioField.storyName = 'RadioField';

export const _RadioBooleanField = ({disabled}) => (
  <Form>
    <RadioBooleanField
      name="subscribe"
      yesLabel="Yes, I would like to receive updates via email"
      noLabel="No, I'd prefer not to receive these updates"
      help="Help text for making an informed decision"
      disabled={disabled}
    />
  </Form>
);

_RadioBooleanField.storyName = 'RadioBooleanField';
_RadioBooleanField.args = {
  disabled: false,
};

export const _SelectField = () => (
  <Form>
    <SelectField
      name="select"
      label="Select Field"
      choices={[
        ['choice_one', 'Choice One'],
        ['choice_two', 'Choice Two'],
        ['choice_three', 'Choice Three'],
      ]}
    />
  </Form>
);

_SelectField.storyName = 'SelectField';

export const SelectFieldMultiple = () => (
  <Form>
    <SelectField
      name="select"
      label="Multi Select"
      multiple
      choices={[
        ['choice_one', 'Choice One'],
        ['choice_two', 'Choice Two'],
        ['choice_three', 'Choice Three'],
      ]}
    />
  </Form>
);

SelectFieldMultiple.storyName = 'SelectField multiple';

export const SelectFieldGrouped = () => (
  <Form>
    <SelectField
      name="select"
      label="Grouped Select"
      options={[
        {
          label: 'Group 1',
          options: [
            {value: 'choice_one', label: 'Choice One'},
            {value: 'choice_two', label: 'Choice Two'},
          ],
        },
        {
          label: 'Group 2',
          options: [
            {value: 'choice_three', label: 'Choice Three'},
            {value: 'choice_four', label: 'Choice Four'},
          ],
        },
      ]}
    />
  </Form>
);

SelectFieldGrouped.storyName = 'SelectField grouped';

export const SelectFieldInFieldLabel = () => (
  <Form>
    <SelectField
      name="select"
      label="Select With Label In Field"
      inFieldLabel="Label: "
      choices={[
        ['choice_one', 'Choice One'],
        ['choice_two', 'Choice Two'],
        ['choice_three', 'Choice Three'],
      ]}
    />
  </Form>
);

SelectFieldInFieldLabel.storyName = 'SelectField label in field';
SelectFieldInFieldLabel.parameters = {
  docs: {
    description: {
      story: 'Select Control w/ Label In Field',
    },
  },
};

export const NonInlineField = () => (
  <Form>
    <FormField name="radio" label="Radio Field" inline={false}>
      {({value, label, onChange}) => (
        <RadioGroup
          onChange={onChange}
          label={label}
          value={value}
          choices={[
            ['choice_one', 'Choice One', 'Description for Choice One'],
            ['choice_two', 'Choice Two', 'Description for Choice Two'],
            ['choice_three', 'Choice Three'],
          ]}
        />
      )}
    </FormField>
  </Form>
);

NonInlineField.storyName = 'Non-inline field';
NonInlineField.parameters = {
  docs: {
    description: {
      story: 'Radio Group used w/ FormField',
    },
  },
};

export const _RangeSlider = () => (
  <div style={{backgroundColor: '#fff', padding: 20}}>
    <RangeSlider
      name="rangeField"
      min={1}
      max={10}
      step={1}
      value={1}
      formatLabel={value => {
        return `${value} Toaster Strudle${value > 1 ? 's' : ''}`;
      }}
    />
  </div>
);

_RangeSlider.storyName = 'RangeSlider';

export const WithoutAParentForm = ({onChange}) => {
  return (
    <div>
      <TextField
        name="simpletextfield"
        label="Simple Text Field"
        placeholder="Simple Text Field"
        onChange={onChange}
      />
      <NewBooleanField name="field" label="New Boolean Field" onChange={onChange} />
      <RadioField
        name="radio"
        label="Radio Field"
        onChange={onChange}
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two'],
          ['choice_three', 'Choice Three'],
        ]}
      />
      <Switch id="test" />
    </div>
  );
};

WithoutAParentForm.storyName = 'Without a parent Form';
WithoutAParentForm.argTypes = {
  onChange: {action: 'onChange'},
};
WithoutAParentForm.parameters = {
  docs: {
    description: {
      story: 'New form fields used without having a parent Form',
    },
  },
};

export const __TextCopyInput = () => (
  <TextCopyInput onCopy={action('Copied!')}>Value to be copied </TextCopyInput>
);

__TextCopyInput.storyName = 'TextCopyInput';
