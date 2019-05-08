import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {text, boolean, select} from '@storybook/addon-knobs';

import Tooltip from 'app/components/tooltip';
import Tooltip2 from 'app/components/tooltip2';
import Button from 'app/components/button';

class CustomThing extends React.Component {
  render() {
    return <span>A class component with no ref</span>;
  }
}

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
      propTablesExclude: [CustomThing, Button, 'Button'],
    })(() => {
      const title = text('tooltip', 'Basic tooltip content');
      const disabled = boolean('Disabled', false);
      const displayMode = select('Container display mode', ['block', 'inline-block', 'inline']);
      const position = select(
        'position',
        {top: 'top', bottom: 'bottom', left: 'left', right: 'right'},
        'top'
      );

      return (
        <React.Fragment>
          <h3>With styled component trigger</h3>
          <p>
            <Tooltip2 title={title} position={position} disabled={disabled} containerDisplayMode={displayMode}>
              <Button>Styled button</Button>
            </Tooltip2>
          </p>

          <h3>With class component trigger</h3>
          <p>
            <Tooltip2 title={title} position={position} disabled={disabled}>
              <CustomThing>Custom React Component</CustomThing>
            </Tooltip2>
          </p>

          <h3>With an SVG element trigger</h3>
          <p>
            <svg
              viewBox="0 0 100 100"
              width="100"
              height="100"
              xmlns="http://www.w3.org/2000/svg"
            >
              <Tooltip2 title={title} position={position} disabled={disabled} containerDisplayMode={displayMode}>
                <circle cx="50" cy="50" r="50" />
              </Tooltip2>
            </svg>
          </p>

          <h3>With element title and native html element</h3>
          <p>
            <Tooltip2
              title={
                <span>
                  <em>so strong</em>
                </span>
              }
              containerDisplayMode={displayMode}
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
