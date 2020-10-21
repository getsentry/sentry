import {withInfo} from '@storybook/addon-info';
import {text} from '@storybook/addon-knobs';

import CommandLine from 'app/components/commandLine';

export default {
  title: 'Core/CommandLine',
};

export const _CommandLine = withInfo('A Command Line Interface')(() => {
  return <CommandLine>{text('children', 'sentry devserver --workers')}</CommandLine>;
});

_CommandLine.story = {
  name: 'CommandLine',
};
