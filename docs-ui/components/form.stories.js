import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import {Form, TextField, PasswordField, BooleanField} from 'sentry-ui/forms';

// eslint-disable-next-line
storiesOf('Forms/Form', module)
  .add('empty', withInfo('Empty form')(() => <Form onSubmit={action('submit')} />))
  .add(
    'with Cancel',
    withInfo('Adds a "Cancel" button when `onCancel` is defined')(() => (
      <Form onCancel={action('cancel')} onSubmit={action('submit')} />
    ))
  );

storiesOf('Forms/Fields', module)
  .add(
    'TextField',
    withInfo('Simple text input')(() => (
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
  )
  .add(
    'PasswordField',
    withInfo('Password input')(() => {
      <div>
        <PasswordField name="password" />
      </div>;
    })
  )
  .add(
    'BooleanField',
    withInfo('Boolean field (i.e. checkbox)')(() => {
      <BooleanField name="field" />;
    })
  );
