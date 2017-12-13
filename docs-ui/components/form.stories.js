import React from 'react';
import PropTypes from 'prop-types';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import {
  Form as LegacyForm,
  TextField,
  PasswordField,
  BooleanField,
} from 'sentry-ui/forms';
import RadioField from 'settings-ui/forms/radioField';
import Form from 'settings-ui/forms/form';

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
  .add('empty', withInfo('Empty form')(() => <Form onSubmit={action('submit')} />))
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
        <TextField
          name="name"
          label="Team Name"
          placeholder="e.g. Operations, Web, Desktop"
          required
        />
        <TextField name="slug" label="Short name" placeholder="e.g. api-team" />
        <UndoButton />
      </LegacyForm>
    ))
  );

storiesOf('Forms/Fields', module)
  .add(
    'TextField',
    withInfo('Simple text input')(() => (
      <LegacyForm saveOnBlur allowUndo>
        <TextField
          name="name"
          label="Team Name"
          placeholder="e.g. Operations, Web, Desktop"
          required
        />
        <TextField name="slug" label="Short name" placeholder="e.g. api-team" />
      </LegacyForm>
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
          choices={() => [[0, 'Choice One'], [1, 'Choice Two'], [2, 'Choice Three']]}
        />
      </Form>
    ))
  );
