import { Component, Fragment } from 'react';
import {withInfo} from '@storybook/addon-info';
import {text, boolean, select} from '@storybook/addon-knobs';

import Tooltip from 'app/components/tooltip';
import Button from 'app/components/button';

class CustomThing extends Component {
  render() {
    return <span>A class component with no ref</span>;
  }
}

export default {
  title: 'Core/Tooltips/Tooltip',
};

export const _Tooltip = withInfo({
  text: 'Adds a tooltip to any component,',
  propTablesExclude: [CustomThing, Button, 'Button'],
})(() => {
  const title = text('tooltip', 'Basic tooltip content');
  const disabled = boolean('Disabled', false);
  const displayMode = select('Container display mode', [
    'block',
    'inline-block',
    'inline',
  ]);
  const position = select(
    'position',
    {top: 'top', bottom: 'bottom', left: 'left', right: 'right'},
    'top'
  );
  const isHoverable = boolean('isHoverable', false);

  return (
    <Fragment>
      <h3>With styled component trigger</h3>
      <p>
        <Tooltip
          title={title}
          position={position}
          disabled={disabled}
          containerDisplayMode={displayMode}
          isHoverable={isHoverable}
        >
          <Button>Styled button</Button>
        </Tooltip>
      </p>

      <h3>With class component trigger</h3>
      <p>
        <Tooltip
          title={title}
          position={position}
          disabled={disabled}
          isHoverable={isHoverable}
        >
          <CustomThing>Custom React Component</CustomThing>
        </Tooltip>
      </p>

      <h3>With an SVG element trigger</h3>
      <p>
        <svg
          viewBox="0 0 100 100"
          width="100"
          height="100"
          xmlns="http://www.w3.org/2000/svg"
        >
          <Tooltip
            title={title}
            position={position}
            disabled={disabled}
            containerDisplayMode={displayMode}
            isHoverable={isHoverable}
          >
            <circle cx="50" cy="50" r="50" />
          </Tooltip>
        </svg>
      </p>

      <h3>With element title and native html element</h3>
      <p>
        <Tooltip
          title={
            <span>
              <em>so strong</em>
            </span>
          }
          containerDisplayMode={displayMode}
          position={position}
          disabled={disabled}
          isHoverable={isHoverable}
        >
          <button>Native button</button>
        </Tooltip>
      </p>
    </Fragment>
  );
});
