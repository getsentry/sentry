import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';

import AlertMessage from 'sentry-ui/alertMessage';

storiesOf('AlertMessage').addWithInfo('Types', '', () => (
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
));
