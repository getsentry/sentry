import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import AlertMessage from 'app/components/alertMessage';

storiesOf('AlertMessage', module)
  .add(
    'Default',
    withInfo('Inline alert messages')(() => (
      <div>
        <AlertMessage
          alert={{
            id: 'id',
            message: 'Info message with a url',
            type: 'info',
            url: 'url',
          }}
        />

        <AlertMessage
          alert={{
            id: 'id',
            message: 'Success message without a url',
            type: 'success',
          }}
        />

        <AlertMessage
          alert={{
            id: 'id',
            message: 'Warning Message',
            type: 'warning',
            url: 'url',
          }}
        />

        <AlertMessage
          alert={{
            id: 'id',
            message: 'Error Message',
            type: 'error',
            url: 'url',
          }}
        />
      </div>
    ))
  )
  .add(
    'System',
    withInfo('System-level alert messages that appear at the top of the viewport')(() => (
      <div>
        <AlertMessage
          alert={{
            id: 'id',
            message: 'Info message with a url',
            type: 'info',
            url: 'url',
          }}
          system
        />

        <AlertMessage
          alert={{
            id: 'id',
            message: 'Success message without a url',
            type: 'success',
          }}
          system
        />

        <AlertMessage
          alert={{
            id: 'id',
            message: 'Warning Message',
            type: 'warning',
            url: 'url',
          }}
          system
        />

        <AlertMessage
          alert={{
            id: 'id',
            message:
              "Background workers haven't checked in recently. This can mean an issue with your configuration or a serious backlog in tasks.",
            type: 'error',
            url: 'url',
          }}
          system
        />
      </div>
    ))
  );
