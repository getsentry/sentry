import React from 'react';
import {action} from '@storybook/addon-actions';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Note from 'app/components/activity/note';

const user = {
  username: 'billy@sentry.io',
  identities: [],
  id: '1',
  name: 'billy@sentry.io',
  dateJoined: '2019-03-09T06:52:42.836Z',
  avatar: {avatarUuid: null, avatarType: 'letter_avatar'},
  email: 'billy@sentry.io',
};

storiesOf('UI|Activity/Note', module).add(
  'default',
  withInfo(
    'An Activity Item is composed of: an author, header, body, and additionally timestamp and a status.'
  )(() => (
    <Note
      author={{type: 'user', user}}
      item={{id: '123'}}
      group={{}}
      onDelete={action('Deleted item')}
      sessionUser={{}}
      memberList={[]}
    />
  ))
);
