import {Component, Fragment} from 'react';

import Button from 'sentry/components/button';
import Tooltip from 'sentry/components/tooltip';

class CustomThing extends Component {
  render() {
    return <span>A class component with no ref</span>;
  }
}

export default {
  title: 'Components/Tooltips/Tooltip',
  component: Tooltip,
};

export const _Tooltip = ({...args}) => {
  return (
    <Fragment>
      <h3>With styled component trigger</h3>
      <p>
        <Tooltip {...args}>
          <Button>Styled button</Button>
        </Tooltip>
      </p>

      <h3>With class component trigger</h3>
      <p>
        <Tooltip {...args}>
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
          <Tooltip {...args}>
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
          {...args}
        >
          <button>Native button</button>
        </Tooltip>
      </p>
    </Fragment>
  );
};
_Tooltip.args = {
  title: 'Basic tooltip content',
  disabled: false,
  /** Container display mode */
  displayMode: undefined,
  position: 'top',
  isHoverable: false,
};
_Tooltip.argTypes = {
  displayMode: {
    control: {
      type: 'select',
      options: ['block', 'inline-block', 'inline'],
    },
  },
  position: {
    control: {
      type: 'select',
      options: [
        'bottom',
        'top',
        'left',
        'right',
        'bottom-start',
        'bottom-end',
        'top-start',
        'top-end',
        'left-start',
        'left-end',
        'right-start',
        'right-end',
        'auto',
      ],
    },
  },
};
_Tooltip.parameters = {
  docs: {
    description: {
      story: 'Adds a tooltip to any component',
    },
  },
};
