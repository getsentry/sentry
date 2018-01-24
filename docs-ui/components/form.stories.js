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
} from 'sentry-ui/forms';
import RadioField from 'settings-ui/forms/radioField';
import RadioGroup from 'settings-ui/forms/radioGroup';
import Form from 'settings-ui/forms/form';
import FormField from 'settings-ui/forms/formField';
import TextField from 'settings-ui/forms/textField';

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

storiesOf('Forms/Fields', module)
  .add(
    'TextField',
    withInfo('Simple text input')(() => (
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
      </Form>
    ))
  )
  .add(
    'PasswordField',
    withInfo('Password input')(() => (
      <LegacyForm>
        <PasswordField hasSavedValue name="password" label="password" />
      </LegacyForm>
    ))
  )
  .add(
    'BooleanField',
    withInfo('Boolean field (i.e. checkbox)')(() => (
      <LegacyForm>
        <BooleanField name="field" />
      </LegacyForm>
    ))
  )
  .add(
    'RadioField',
    withInfo('Radio field')(() => (
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
    withInfo('Radio field')(() => (
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
  );
