import {Component, Fragment} from 'react';

import Button from 'sentry/components/button';
import Tooltip from 'sentry/components/tooltip';

class CustomThing extends Component {
  render() {
    return <span>A class component with no ref</span>;
  }
}

class PassThroughComponent extends Component {
  render() {
    return this.props.children;
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

      <h3>With overflowing text</h3>
      <p>
        <Tooltip {...args}>
          <div
            style={{
              width: 'fit-content',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              resize: 'horizontal',
            }}
          >
            Activate showOnOverflow and drag the right side to make this text overflow.
            Tooltip will appear on hover when text overflows.
          </div>
        </Tooltip>
      </p>

      <h3>With custom component with text</h3>
      <p>
        <Tooltip {...args}>
          <PassThroughComponent>
            <div
              style={{
                width: 'fit-content',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                resize: 'horizontal',
              }}
            >
              This text is in a custom react component. Activate showOnOverflow and drag
              the right side to make this text overflow.
            </div>
          </PassThroughComponent>
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
  showOnOverflow: false,
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
