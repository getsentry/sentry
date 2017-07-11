import React from 'react';
import {storiesOf} from '@storybook/react';
import {action} from '@storybook/addon-actions';

import {Form, TextField, PasswordField, BooleanField} from 'sentry-ui/forms';

// eslint-disable-next-line
storiesOf('Forms')
  .addWithInfo('empty', 'Empty form', () => <Form onSubmit={action('submit')} />)
  .addWithInfo('with Cancel', 'Adds a "Cancel" button when `onCancel` is defined', () => (
    <Form onCancel={action('cancel')} onSubmit={action('submit')} />
  ))
  .addWithInfo('TextField', 'Simple text input', () => (
    <div>
      <TextField
        name="name"
        label="Team Name"
        placeholder="e.g. Operations, Web, Desktop"
        required
      />
      <TextField name="slug" label="Short name" placeholder="e.g. api-team" />
    </div>
  ))
  .addWithInfo('PasswordField', 'Password input', () => {
    <div>
      <PasswordField name="password" />
    </div>;
  })
  .addWithInfo('BooleanField', 'Boolean field (i.e. checkbox)', () => {
    <BooleanField name="field" />;
  });
