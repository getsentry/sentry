import React from 'react';

import SeenByList from 'app/components/seenByList';

const USER = {
  id: 1,
  name: 'Jane Bloggs',
  email: 'janebloggs@example.com',
};

export default {
  title: 'UI/SeenByList',
  args: {
    avatarSize: 28,
    iconTooltip: 'icon tooltip message',
    maxVisibleAvatars: 5,
  },
};

export const Default = ({maxVisibleAvatars, avatarSize, iconTooltip}) => {
  const user = {...USER};
  return (
    <SeenByList
      seenBy={[user]}
      avatarSize={avatarSize}
      iconTooltip={iconTooltip}
      maxVisibleAvatars={maxVisibleAvatars}
    />
  );
};

Default.storyName = 'default';
Default.parameters = {
  docs: {
    description: {
      story: 'This displays a list of avatars but filters out the current user',
    },
  },
};
