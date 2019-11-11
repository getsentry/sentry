import React from 'react';

import {number, string} from '@storybook/addon-knobs';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import SeenByList from 'app/components/seenByList';

const USER = {
  id: 1,
  name: 'Jane Bloggs',
  email: 'janebloggs@example.com',
};

// eslint-disable-next-line
storiesOf('UI|Other/SeenByList', module).add(
  'default',
  withInfo('This displays a list of avatars but filters out the current user')(() => {
    const user = {...USER};
    return (
      <SeenByList
        seenBy={[user]}
        avatarSize={number('avatarSize', 28)}
        iconTooltip={string('iconTooltip', 'icon tooltip message')}
        maxVisibleAvatars={number('maxVisibleAvatars', 5)}
      />
    );
  })
);
