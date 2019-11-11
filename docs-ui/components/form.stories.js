import PropTypes from 'prop-types';
import React from 'react';

import {
  Form as LegacyForm,
  TextField as LegacyTextField,
  PasswordField,
  BooleanField,
} from 'app/components/forms';
import {Panel} from 'app/components/panels';
import {action} from '@storybook/addon-actions';
import {number, boolean} from '@storybook/addon-knobs';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import DatePickerField from 'app/views/settings/components/forms/datePickerField';
import Form from 'app/views/settings/components/forms/form';
import FormField from 'app/views/settings/components/forms/formField';
import NewBooleanField from 'app/views/settings/components/forms/booleanField';
import RadioField from 'app/views/settings/components/forms/radioField';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';
import RangeField from 'app/views/settings/components/forms/rangeField';
import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';
import SelectField from 'app/views/settings/components/forms/selectField';
import Switch from 'app/components/switch';
import TextField from 'app/views/settings/components/forms/textField';
import TextareaField from 'app/views/settings/components/forms/textareaField';

class UndoButton extends React.Component {
  handleClick(e) {
    e.preventDefault();
    this.context.form.undo();
  }

  render() {
    return (
      <button type="button" onClick={this.handleClick.bind(this)}>
        Undo
      </button>
    );
  }
}

UndoButton.contextTypes = {
  form: PropTypes.object,
};

// eslint-disable-next-line
storiesOf('Forms|Old/Form', module)
  .add('empty', withInfo('Empty form')(() => <LegacyForm onSubmit={action('submit')} />))
  .add(
    'with Cancel',
    withInfo('Adds a "Cancel" button when `onCancel` is defined')(() => (
      <LegacyForm onCancel={action('cancel')} onSubmit={action('submit')} />
    ))
  )
  .add(
    'save on blur and undo',
    withInfo('Saves on blur and has undo')(() => (
      <LegacyForm saveOnBlur allowUndo>
        <LegacyTextField
          name="name"
          label="Team Name"
          placeholder="e.g. Operations, Web, Desktop"
          required
        />
        <LegacyTextField name="slug" label="Short name" placeholder="e.g. api-team" />
        <UndoButton />
      </LegacyForm>
    ))
  );

storiesOf('Forms|Form', module).add(
  'default',
  withInfo(
    'Use the knobs to see how the different field props that can be used affect the form layout.'
  )(() => {
    const fieldProps = {
      alignRight: boolean('Align right', false),
      required: boolean('Required', false),
      visible: boolean('Visible', true),
      disabled: boolean('Disabled', false),
      flexibleControlStateSize: boolean('Flexible Control State Size', true),
      inline: boolean('Inline (Label and Control on same line)', true),
      stacked: boolean(
        'Stacked (Fields are on top of each other without a border)',
        true
      ),
    };
    return (
      <Form>
        <TextField
          name="textfieldflexiblecontrol"
          label="Text Field With Flexible Control State Size"
          placeholder="Type text and then delete it"
          {...fieldProps}
        />
        <NewBooleanField name="field" label="New Boolean Field" {...fieldProps} />
        <RadioField
          name="radio"
          label="Radio Field"
          choices={[
            ['choice_one', 'Choice One'],
            ['choice_two', 'Choice Two'],
            ['choice_three', 'Choice Three'],
          ]}
          {...fieldProps}
        />
        <SelectField
          name="select"
          label="Select Field"
          choices={[
            ['choice_one', 'Choice One'],
            ['choice_two', 'Choice Two'],
            ['choice_three', 'Choice Three'],
          ]}
          {...fieldProps}
        />
        <RangeField
          name="rangeField"
          label="Range Field"
          min={1}
          max={10}
          step={1}
          value={1}
          formatLabel={value => {
            return `${value} Toaster Strudle${value > 1 ? 's' : ''}`;
          }}
          {...fieldProps}
        />
      </Form>
    );
  })
);

storiesOf('Forms|Old/Fields', module)
  .add(
    'PasswordField',
    withInfo({
      text: 'Password input',
      propTablesExclude: [LegacyForm],
    })(() => (
      <LegacyForm>
        <PasswordField hasSavedValue name="password" label="password" />
      </LegacyForm>
    ))
  )
  .add(
    'BooleanField',
    withInfo({
      text: 'Boolean field (i.e. checkbox)',
      propTablesExclude: [LegacyForm],
    })(() => (
      <LegacyForm>
        <BooleanField name="field" />
      </LegacyForm>
    ))
  );

storiesOf('Forms|Fields', module)
  .add(
    'TextField',
    withInfo({
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
    ))
  )
  .add(
    'TextareaField',
    withInfo({
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
    ))
  )
  .add(
    'BooleanField',
    withInfo({
      text: 'Boolean field (i.e. checkbox)',
      propTablesExclude: [Form],
    })(() => (
      <Form>
        <NewBooleanField name="field" label="New Boolean Field" />
      </Form>
    ))
  )
  .add(
    'DatePickerField',
    withInfo({
      text: 'Date picker field with a popup calendar picker (for a single date)',
      propTablesExclude: [Form],
    })(() => (
      <Form>
        <DatePickerField name="field" label="Date Picker Field" />
      </Form>
    ))
  )
  .add(
    'RadioField',
    withInfo({
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
    ))
  )
  .add(
    'SelectField',
    withInfo({
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
    ))
  )
  .add(
    'SelectField multiple',
    withInfo({
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
    ))
  )
  .add(
    'Non-inline field',
    withInfo({
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
    ))
  )
  .add(
    'RangeSlider',
    withInfo('Range slider')(() => (
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
    ))
  )
  .add(
    'Without a parent Form',
    withInfo('New form fields used without having a parent Form')(() => {
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
    })
  );
