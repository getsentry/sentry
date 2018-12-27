import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import MutedBox from 'app/components/mutedBox';

storiesOf('UI|Muted Box', module)
  .add('default', withInfo('Default')(() => <MutedBox statusDetails={{}} />))
  .add(
    'ignoreUntil',
    withInfo('Ignore until timestamp')(() => (
      <MutedBox statusDetails={{ignoreUntil: '2017-06-21T19:45:10Z'}} />
    ))
  )
  .add(
    'ignoreCount',
    withInfo('Ignore until "count"')(() => (
      <MutedBox statusDetails={{ignoreCount: 100}} />
    ))
  )
  .add(
    'ignoreCount w/ ignoreWindow',
    withInfo('Ignore count with window')(() => (
      <MutedBox statusDetails={{ignoreCount: 100, ignoreWindow: 1}} />
    ))
  )
  .add(
    'ignoreUserCount',
    withInfo('Ignore user count')(() => (
      <MutedBox statusDetails={{ignoreUserCount: 100}} />
    ))
  )
  .add(
    'ignoreUserCount w/ ignoreUserWindow',
    withInfo('Ignore user count with window')(() => (
      <MutedBox statusDetails={{ignoreUserCount: 100, ignoreUserWindow: 1}} />
    ))
  );
