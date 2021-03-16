import React from 'react';
import {action} from '@storybook/addon-actions';

import Note from 'app/components/activity/note';
import ConfigStore from 'app/stores/configStore';

// TODO(scttcper): Not working
const user = {
  username: 'billy@sentry.io',
  identities: [],
  id: '1',
  name: 'billy@sentry.io',
  dateJoined: '2019-03-09T06:52:42.836Z',
  avatar: {avatarUuid: null, avatarType: 'letter_avatar'},
  email: 'billy@sentry.io',
};

ConfigStore.set('user', {...user, isSuperuser: true, options: {}});

export default {
  title: 'UI/Activity/Note',
};

export const Default = () => (
  <Note
    author={{name: 'Billy'}}
    item={{id: '123', data: {text: 'hello'}, user, dateCreated: new Date()}}
    group={{project: {slug: 'sentry'}}}
    onDelete={action('Deleted item')}
    sessionUser={{}}
    memberList={[]}
  />
);

Default.storyName = 'Note';
Default.parameters = {
  docs: {
    description: {
      story:
        'A `<Note>` is an `<ActivityItem>` that can be edited with an editor. The editor has an input mode and a preview mode.',
    },
  },
};
