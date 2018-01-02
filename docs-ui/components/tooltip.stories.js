import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Tooltip from 'sentry-ui/tooltip';
import Button from 'sentry-ui/buttons/button';

storiesOf('Tooltip', module).add(
  'default',
  withInfo('Description')(() => (
    <div>
      <h1>Test</h1>
      <div>
        <Tooltip title="My tooltip">
          <Button>Custom React Component</Button>
        </Tooltip>
      </div>

      <div>
        <Tooltip
          title="My tooltip with options"
          tooltipOptions={{
            placement: 'bottom',
          }}
        >
          <button>Native button</button>
        </Tooltip>
      </div>
    </div>
  ))
);
