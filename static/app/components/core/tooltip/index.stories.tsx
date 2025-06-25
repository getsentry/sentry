import {Fragment} from 'react';

import {Button} from 'sentry/components/core/button';
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
});
