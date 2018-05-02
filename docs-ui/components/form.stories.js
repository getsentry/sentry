import React from 'react';
import PropTypes from 'prop-types';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import {
  Form as LegacyForm,
  TextField as LegacyTextField,
  PasswordField,
  BooleanField,
} from 'app/components/forms';
import NewBooleanField from 'app/views/settings/components/forms/booleanField';
import RadioField from 'app/views/settings/components/forms/radioField';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';
import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';
import Form from 'app/views/settings/components/forms/form';
import FormField from 'app/views/settings/components/forms/formField';
import TextField from 'app/views/settings/components/forms/textField';

class UndoButton extends React.Component {
  static contextTypes = {
    form: PropTypes.object,
  };

  handleClick = e => {
    e.preventDefault();
    this.context.form.undo();
  };

  render() {
    return (
      <button type="button" onClick={this.handleClick}>
        Undo
      </button>
    );
  }
}

// eslint-disable-next-line
storiesOf('Forms/Form', module)
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

storiesOf('Forms/Fields/Old', module)
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

storiesOf('Forms/Fields/New', module)
  .add(
    'TextField',
    withInfo({
      text: 'Simple text input',
      propTablesExclude: [Form],
    })(() => (
      <Form initialData={{context: {location: 'cat'}}}>
        <TextField
          name="simpletextfield"
          label="Simple Text Field"
          placeholder="Simple Text Field"
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
      </Form>
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
                ['choice_one', 'Choice One'],
                ['choice_two', 'Choice Two'],
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
  );
