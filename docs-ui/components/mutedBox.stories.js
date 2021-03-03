import React from 'react';

import MutedBox from 'app/components/mutedBox';

export default {
  title: 'Features/Issues/Muted Box',
  component: MutedBox,
};

export const Default = () => <MutedBox statusDetails={{}} />;

Default.storyName = 'default';

export const IgnoreUntil = () => (
  <MutedBox statusDetails={{ignoreUntil: '2017-06-21T19:45:10Z'}} />
);

IgnoreUntil.storyName = 'ignoreUntil';
IgnoreUntil.parameters = {
  docs: {
    description: {
      story: 'Ignore until timestamp',
    },
  },
};

export const IgnoreCount = () => <MutedBox statusDetails={{ignoreCount: 100}} />;

IgnoreCount.storyName = 'ignoreCount';
IgnoreCount.parameters = {
  docs: {
    description: {
      story: 'Ignore until "count"',
    },
  },
};

export const IgnoreCountWIgnoreWindow = () => (
  <MutedBox statusDetails={{ignoreCount: 100, ignoreWindow: 1}} />
);

IgnoreCountWIgnoreWindow.storyName = 'ignoreCount w/ ignoreWindow';
IgnoreCountWIgnoreWindow.parameters = {
  docs: {
    description: {
      story: 'Ignore count with window',
    },
  },
};

export const IgnoreUserCount = () => <MutedBox statusDetails={{ignoreUserCount: 100}} />;

IgnoreUserCount.storyName = 'ignoreUserCount';
IgnoreUserCount.parameters = {
  docs: {
    description: {
      story: 'Ignore user count',
    },
  },
};

export const IgnoreUserCountWIgnoreUserWindow = () => (
  <MutedBox statusDetails={{ignoreUserCount: 100, ignoreUserWindow: 1}} />
);

IgnoreUserCountWIgnoreUserWindow.storyName = 'ignoreUserCount w/ ignoreUserWindow';
IgnoreUserCountWIgnoreUserWindow.parameters = {
  docs: {
    description: {
      story: 'Ignore user count with window',
    },
  },
};
