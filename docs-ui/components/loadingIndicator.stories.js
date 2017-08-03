import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';

import LoadingIndicator from 'sentry-ui/loadingIndicator';

storiesOf('LoadingIndicator')
  .addWithInfo('', 'Loading indicators. Triangle has negative margins.', () => (
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
    </div>
  ))
  .addWithInfo('default', 'Default loading indicator', () => (
    <LoadingIndicator>
      Loading message
    </LoadingIndicator>
  ))
  .addWithInfo('mini', 'Small loading indicator', () => (
    <LoadingIndicator mini>
      Loading message
    </LoadingIndicator>
  ))
  .addWithInfo(
    'triangle',
    'Triangle loading indicator. Be aware it has negative margins.',
    () => (
      <div style={{paddingBottom: 300}}>
        <LoadingIndicator triangle>
          Loading message
        </LoadingIndicator>
      </div>
    )
  );
