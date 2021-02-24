import React from 'react';

import CommandLine from 'app/components/commandLine';

export default {
  title: 'Utilities/CommandLine',
  args: {
    children: 'sentry devserver --workers',
  },
};

export const _CommandLine = ({children}) => {
  return <CommandLine>{children}</CommandLine>;
};

_CommandLine.storyName = 'CommandLine';
