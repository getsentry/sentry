import React from 'react';
import {action} from '@storybook/addon-actions';
import {number, boolean} from '@storybook/addon-knobs';
import {withInfo} from '@storybook/addon-info';

import {Panel} from 'app/components/panels';
import DatePickerField from 'app/views/settings/components/forms/datePickerField';
import Form from 'app/views/settings/components/forms/form';
import FormField from 'app/views/settings/components/forms/formField';
import NewBooleanField from 'app/views/settings/components/forms/booleanField';
import RadioField from 'app/views/settings/components/forms/radioField';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';
import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';
import SelectField from 'app/views/settings/components/forms/selectField';
import Switch from 'app/components/switch';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import TextField from 'app/views/settings/components/forms/textField';
import TextareaField from 'app/views/settings/components/forms/textareaField';

export default {
  title: 'Forms/Fields',
};

export const _TextField = withInfo({
  text: 'Simple text input',
  propTablesExclude: [Form],
})(() => (
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
));

_TextField.story = {
  name: 'TextField',
};

export const _TextareaField = withInfo({
  text: 'Textarea input',
  propTablesExclude: [Form],
})(() => (
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
        autosize={boolean('autosize', true)}
        label="Textarea field with autosize"
        rows={number('Number of rows', 2)}
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
));

_TextareaField.story = {
  name: 'TextareaField',
};

export const __BooleanField = withInfo({
  text: 'Boolean field (i.e. checkbox)',
  propTablesExclude: [Form],
})(() => (
  <Form>
    <NewBooleanField name="field" label="New Boolean Field" />
  </Form>
));

__BooleanField.story = {
  name: 'BooleanField',
};

export const _DatePickerField = withInfo({
  text: 'Date picker field with a popup calendar picker (for a single date)',
  propTablesExclude: [Form],
})(() => (
  <Form>
    <DatePickerField name="field" label="Date Picker Field" />
  </Form>
));

_DatePickerField.story = {
  name: 'DatePickerField',
};

export const _RadioField = withInfo({
  text: 'Radio field',
  propTablesExclude: [Form],
})(() => (
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
  </Form>
));

_RadioField.story = {
  name: 'RadioField',
};

export const _SelectField = withInfo({
  text: 'Select Field',
  propTablesExclude: [Form],
})(() => (
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
));

_SelectField.story = {
  name: 'SelectField',
};

export const SelectFieldMultiple = withInfo({
  text: 'Select Control w/ multiple',
  propTablesExclude: [Form],
})(() => (
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
));

SelectFieldMultiple.story = {
  name: 'SelectField multiple',
};

export const NonInlineField = withInfo({
  text: 'Radio Group used w/ FormField',
  propTablesExclude: [Form],
})(() => (
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
));

NonInlineField.story = {
  name: 'Non-inline field',
};

export const _RangeSlider = withInfo('Range slider')(() => (
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
));

_RangeSlider.story = {
  name: 'RangeSlider',
};

export const WithoutAParentForm = withInfo(
  'New form fields used without having a parent Form'
)(() => {
  return (
    <div>
      <TextField
        name="simpletextfield"
        label="Simple Text Field"
        placeholder="Simple Text Field"
        onChange={action('TextField onChange')}
      />
      <NewBooleanField
        name="field"
        label="New Boolean Field"
        onChange={action('BooleanField onChange')}
      />
      <RadioField
        name="radio"
        label="Radio Field"
        onChange={action('RadioField onChange')}
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two'],
          ['choice_three', 'Choice Three'],
        ]}
      />
      <Switch id="test" />
    </div>
  );
});

WithoutAParentForm.story = {
  name: 'Without a parent Form',
};

export const __TextCopyInput = withInfo('Description')(() => (
  <TextCopyInput onCopy={action('Copied!')}>Value to be copied </TextCopyInput>
));

__TextCopyInput.story = {
  name: 'TextCopyInput',
};
