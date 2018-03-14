import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import UserListElement from 'sentry-ui/userListElement';

const user = {
  name: 'Chrissy',
  email: 'chris.clark@sentry.io',
};

storiesOf('UserListElement', module).add(
  'default',
  withInfo(
    'A very simple one-line username with avatar. It does not come with a link.'
  )(() => <UserListElement user={user} />)
);
