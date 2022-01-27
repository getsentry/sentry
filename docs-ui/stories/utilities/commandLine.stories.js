import CommandLine from 'sentry/components/commandLine';

export default {
  title: 'Utilities/Command Line',
  args: {
    children: 'sentry devserver --workers',
  },
};

export const _CommandLine = ({children}) => {
  return <CommandLine>{children}</CommandLine>;
};

_CommandLine.storyName = 'Command Line';
