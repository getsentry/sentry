import {Fragment} from 'react';

import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/tooltip';

export default storyBook('Tooltip', (story, APIReference) => {
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
          <JSXProperty name="skipWrapper" value="true" /> prop.
        </p>
        <SideBySide>
          <Tooltip title="Tooltip">
            <Button>Hover me</Button>
          </Tooltip>
        </SideBySide>
      </Fragment>
    );
  });

  story('Hoverable Tooltip', () => {
    return (
      <Fragment>
        <p>
          A tooltip is not hoverable by default and will hide before the pointer enters
          it's container - to make it hoverable, pass the{' '}
          <JSXProperty name="isHoverable" value="true" /> prop.
        </p>
        <SideBySide>
          <Tooltip title="This can be copied" isHoverable skipWrapper>
            <Button>Hoverable Tooltip</Button>
          </Tooltip>
          <Tooltip title="This cannot be copied" skipWrapper>
            <Button>Non Hoverable Tooltip</Button>
          </Tooltip>
        </SideBySide>
      </Fragment>
    );
  });
});
