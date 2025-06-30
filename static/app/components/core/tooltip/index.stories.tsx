import {Fragment} from 'react';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import * as Storybook from 'sentry/stories';

import types from '!!type-loader!sentry/components/core/tooltip';

export default Storybook.story('Tooltip', (story, APIReference) => {
  APIReference(types.Tooltip);

  story('Default', () => {
    return (
      <Fragment>
        <p>
          Tooltip is a component that displays a tooltip when hovering over an element
          (duh).
        </p>
        <p>
          By default, a tooltip renders a wrapper around the children element and renders
          the tooltip content in a portal. The wrapper can be skipped by passing the{' '}
          <Storybook.JSXProperty name="skipWrapper" value="true" /> prop.
        </p>
        <Storybook.SideBySide>
          <Tooltip title="Tooltip">
            <Button>Hover me</Button>
          </Tooltip>
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Hoverable Tooltip', () => {
    return (
      <Fragment>
        <p>
          A tooltip is not hoverable by default and will hide before the pointer enters
          it's container - to make it hoverable, pass the{' '}
          <Storybook.JSXProperty name="isHoverable" value="true" /> prop.
        </p>
        <Storybook.SideBySide>
          <Tooltip title="This can be copied" isHoverable skipWrapper>
            <Button>Hoverable Tooltip</Button>
          </Tooltip>
          <Tooltip title="This cannot be copied" skipWrapper>
            <Button>Non Hoverable Tooltip</Button>
          </Tooltip>
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('All Positions', () => {
    return (
      <Fragment>
        <p>
          Tooltips can be positioned in different directions. Use the{' '}
          <Storybook.JSXNode name="position" /> prop to control placement.
        </p>
        <Flex direction="column" gap={1} align="center">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              margin: '40px 0 40px 0',
              alignItems: 'center',
            }}
          >
            <Tooltip title="Top Tooltip Position" position="top" forceVisible>
              <Button>Top</Button>
            </Tooltip>
            <div style={{display: 'flex', gap: '8px'}}>
              <Tooltip title="Left Tooltip Position" position="left" forceVisible>
                <Button>Left</Button>
              </Tooltip>
              <Tooltip title="Right Tooltip Position" position="right" forceVisible>
                <Button>Right</Button>
              </Tooltip>
            </div>
            <Tooltip title="Bottom Tooltip Position" position="bottom" forceVisible>
              <Button>Bottom</Button>
            </Tooltip>
          </div>
        </Flex>
      </Fragment>
    );
  });
});
