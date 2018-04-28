import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import UserBadge from 'app/components/userBadge';

const user = {
  name: 'Chrissy',
  email: 'chris.clark@sentry.io',
};

storiesOf('UserBadge', module)
  .add(
    'default',
    withInfo('A standard two-line user badge. It contains a link to the user.')(() => (
      <UserBadge user={user} />
    ))
  )
  .add(
    'hides email',
    withInfo('Can hide the user email')(() => <UserBadge user={user} hideEmail />)
  );
