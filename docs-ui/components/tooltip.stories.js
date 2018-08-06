import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {text, boolean} from '@storybook/addon-knobs';

import Tooltip from 'app/components/tooltip';
import Button from 'app/components/buttons/button';

storiesOf('Tooltip', module).add(
  'default',
  withInfo({
    text: 'Adds a tool to any component',
    propTablesExclude: [Button],
  })(() => {
    let title = text('My tooltip', 'My tooltip');
    let disabled = boolean('Disabled', false);

    return (
      <div>
        <p>Test</p>
        <div>
          <Tooltip title={title} disabled={disabled}>
            <Button>Custom React Component</Button>
          </Tooltip>
        </div>
        <p>Test with options</p>

        <div>
          <Tooltip
            title={title}
            disabled={disabled}
            tooltipOptions={{
              placement: 'bottom',
            }}
          >
            <button>Native button</button>
          </Tooltip>
        </div>
      </div>
    );
  })
);
