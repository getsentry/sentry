import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {text, boolean, select} from '@storybook/addon-knobs';

import Tooltip from 'app/components/tooltip';
import Tooltip2 from 'app/components/tooltip2';
import Button from 'app/components/button';

storiesOf('UI|Tooltip', module)
  .add(
    'Tooltip',
    withInfo({
      text: 'Adds a tool to any component',
      propTablesExclude: [Button],
    })(() => {
      const title = text('My tooltip', 'My tooltip');
      const disabled = boolean('Disabled', false);

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
  )
  .add(
    'Tooltip v2',
    withInfo({
      text: 'Adds a tooltip to any component,',
      propTablesExclude: [Button, 'Button'],
    })(() => {
      const title = text('tooltip', 'Basic tooltip content');
      const disabled = boolean('Disabled', false);
      const position = select(
        'position',
        {top: 'top', bottom: 'bottom', left: 'left', right: 'right'},
        'top'
      );

      return (
        <React.Fragment>
          <h3>With styled component trigger</h3>
          <p>
            <Tooltip2 isStyled title={title} position={position} disabled={disabled}>
              <Button>Custom React Component</Button>
            </Tooltip2>
          </p>

          <h3>With element title and native html element</h3>
          <p>
            <Tooltip2
              title={
                <span>
                  <em>so strong</em>
                </span>
              }
              position={position}
              disabled={disabled}
            >
              <button>Native button</button>
            </Tooltip2>
          </p>
        </React.Fragment>
      );
    })
  );
