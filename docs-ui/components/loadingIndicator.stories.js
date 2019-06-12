import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import LoadingIndicator from 'app/components/loadingIndicator';

storiesOf('UI|Loaders/LoadingIndicator', module)
  .add(
    'all',
    withInfo('Loading indicators. Triangle has negative margins.')(() => (
      <div>
        <div>
          Default
          <LoadingIndicator />
        </div>
        <div style={{marginBottom: 240}}>
          Mini
          <LoadingIndicator mini />
        </div>
        <div style={{position: 'relative'}}>
          Triangle
          <LoadingIndicator triangle />
        </div>
        <div style={{position: 'relative'}}>
          Finished
          <LoadingIndicator finished />
        </div>
      </div>
    ))
  )
  .add(
    'default',
    withInfo('Default loading indicator')(() => (
      <LoadingIndicator>Loading message</LoadingIndicator>
    ))
  )
  .add(
    'mini',
    withInfo('Small loading indicator')(() => (
      <LoadingIndicator mini>Loading message</LoadingIndicator>
    ))
  )
  .add(
    'triangle',
    withInfo('Triangle loading indicator. Be aware it has negative margins.')(() => (
      <div style={{paddingBottom: 300}}>
        <LoadingIndicator triangle>Loading message</LoadingIndicator>
      </div>
    ))
  )
  .add(
    'finished',
    withInfo('Add finished loading')(() => (
      <div style={{paddingBottom: 300}}>
        <LoadingIndicator finished>Finished message</LoadingIndicator>
      </div>
    ))
  );
