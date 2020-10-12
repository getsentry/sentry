import React from 'react';
import {withInfo} from '@storybook/addon-info';

import MutedBox from 'app/components/mutedBox';

export default {
  title: 'Features/Issues/Muted Box',
};

export const Default = withInfo('Default')(() => <MutedBox statusDetails={{}} />);

Default.story = {
  name: 'default',
};

export const IgnoreUntil = withInfo('Ignore until timestamp')(() => (
  <MutedBox statusDetails={{ignoreUntil: '2017-06-21T19:45:10Z'}} />
));

IgnoreUntil.story = {
  name: 'ignoreUntil',
};

export const IgnoreCount = withInfo('Ignore until "count"')(() => (
  <MutedBox statusDetails={{ignoreCount: 100}} />
));

IgnoreCount.story = {
  name: 'ignoreCount',
};

export const IgnoreCountWIgnoreWindow = withInfo('Ignore count with window')(() => (
  <MutedBox statusDetails={{ignoreCount: 100, ignoreWindow: 1}} />
));

IgnoreCountWIgnoreWindow.story = {
  name: 'ignoreCount w/ ignoreWindow',
};

export const IgnoreUserCount = withInfo('Ignore user count')(() => (
  <MutedBox statusDetails={{ignoreUserCount: 100}} />
));

IgnoreUserCount.story = {
  name: 'ignoreUserCount',
};

export const IgnoreUserCountWIgnoreUserWindow = withInfo(
  'Ignore user count with window'
)(() => <MutedBox statusDetails={{ignoreUserCount: 100, ignoreUserWindow: 1}} />);

IgnoreUserCountWIgnoreUserWindow.story = {
  name: 'ignoreUserCount w/ ignoreUserWindow',
};
