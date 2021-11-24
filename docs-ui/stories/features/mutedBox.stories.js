import MutedBox from 'sentry/components/mutedBox';

export default {
  title: 'Features/Issues/Muted Box',
  component: MutedBox,
};

export const Default = () => <MutedBox statusDetails={{}} />;

Default.storyName = 'Default';

export const IgnoreUntil = () => (
  <MutedBox statusDetails={{ignoreUntil: '2017-06-21T19:45:10Z'}} />
);

IgnoreUntil.storyName = 'Ignore Until Timestamp';
IgnoreUntil.parameters = {
  docs: {
    description: {
      story: 'Ignore until timestamp',
    },
  },
};

export const IgnoreCount = () => <MutedBox statusDetails={{ignoreCount: 100}} />;

IgnoreCount.storyName = 'Ignore Until Count';
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

IgnoreCountWIgnoreWindow.storyName = 'Ignore Count with Ignore Window';
IgnoreCountWIgnoreWindow.parameters = {
  docs: {
    description: {
      story: 'Ignore count with window',
    },
  },
};

export const IgnoreUserCount = () => <MutedBox statusDetails={{ignoreUserCount: 100}} />;

IgnoreUserCount.storyName = 'Ignore User Count';
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

IgnoreUserCountWIgnoreUserWindow.storyName = 'Ignore User Count with Ignore User Window';
IgnoreUserCountWIgnoreUserWindow.parameters = {
  docs: {
    description: {
      story: 'Ignore user count with window',
    },
  },
};
