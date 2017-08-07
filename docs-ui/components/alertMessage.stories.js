import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import AlertMessage from 'sentry-ui/alertMessage';

storiesOf('AlertMessage', module).add(
  'all',
  withInfo('All of the different alert messages')(() => (
    <div>
      <AlertMessage
        alert={{
          id: 'id',
          message: 'Alert Message',
          type: 'success',
          url: 'url'
        }}
      />

      <AlertMessage
        alert={{
          id: 'id',
          message: 'Alert Message',
          type: 'error',
          url: 'url'
        }}
      />
      <AlertMessage
        alert={{
          id: 'id',
          message: 'Alert Message',
          type: 'warning',
          url: 'url'
        }}
      />
    </div>
  ))
);
