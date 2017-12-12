import React from 'react';
import PropTypes from 'prop-types';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import {Form, TextField, PasswordField, BooleanField} from 'sentry-ui/forms';

class UndoButton extends React.Component {
  static contextTypes = {
    form: PropTypes.object
  };

  handleClick = e => {
    e.preventDefault();
    this.context.form.undo();
  };

  render() {
    return <button type="button" onClick={this.handleClick}> Undo</button>;
  }
}

// eslint-disable-next-line
storiesOf('Forms/Form', module)
  .add('empty', withInfo('Empty form')(() => <Form onSubmit={action('submit')} />))
  .add(
    'with Cancel',
    withInfo('Adds a "Cancel" button when `onCancel` is defined')(() => (
      <Form onCancel={action('cancel')} onSubmit={action('submit')} />
    ))
  )
  .add(
    'save on blur and undo',
    withInfo('Saves on blur and has undo')(() => (
      <Form saveOnBlur allowUndo>
        <TextField
          name="name"
          label="Team Name"
          placeholder="e.g. Operations, Web, Desktop"
          required
        />
        <TextField name="slug" label="Short name" placeholder="e.g. api-team" />
        <UndoButton />
      </Form>
    ))
  );

storiesOf('Forms/Fields', module)
  .add(
    'TextField',
    withInfo('Simple text input')(() => (
      <Form saveOnBlur allowUndo>
        <TextField
          name="name"
          label="Team Name"
          placeholder="e.g. Operations, Web, Desktop"
          required
        />
        <TextField name="slug" label="Short name" placeholder="e.g. api-team" />
      </Form>
    ))
  )
  .add(
    'PasswordField',
    withInfo('Password input')(() => (
      <Form>
        <PasswordField hasSavedValue name="password" label="password" />
      </Form>
    ))
  )
  .add(
    'BooleanField',
    withInfo('Boolean field (i.e. checkbox)')(() => (
      <Form>
        <BooleanField name="field" />
      </Form>
    ))
  );
