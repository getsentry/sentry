import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import UserBadge from 'sentry-ui/userBadge';

const user = {
  name: 'Chrissy',
  email: 'chris.clark@sentry.io',
};

storiesOf('UserBadge', module).add(
  'default',
  withInfo('A standard two-line user badge. It contains a link to the user.')(() => (
    <UserBadge user={user} />
  ))
);
