import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';

import MutedBox from 'sentry-ui/mutedBox';

storiesOf('Muted Box')
  .addWithInfo('default', 'Default', () => <MutedBox statusDetails={{}} />)
  .addWithInfo('ignoreUntil', 'Ignore until timestamp', () => (
    <MutedBox statusDetails={{ignoreUntil: '2017-06-21T19:45:10Z'}} />
  ))
  .addWithInfo('ignoreCount', 'Ignore until "count"', () => (
    <MutedBox statusDetails={{ignoreCount: 100}} />
  ))
  .addWithInfo('ignoreCount w/ ignoreWindow', 'Ignore count with window', () => (
    <MutedBox statusDetails={{ignoreCount: 100, ignoreWindow: 1}} />
  ))
  .addWithInfo('ignoreUserCount', 'Ignore user count', () => (
    <MutedBox statusDetails={{ignoreUserCount: 100}} />
  ))
  .addWithInfo(
    'ignoreUserCount w/ ignoreUserWindow',
    'Ignore user count with window',
    () => <MutedBox statusDetails={{ignoreUserCount: 100, ignoreUserWindow: 1}} />
  );
