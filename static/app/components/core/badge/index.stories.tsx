import {Fragment} from 'react';

import {Badge} from 'sentry/components/core/badge';
import * as Storybook from 'sentry/stories';

import types from '!!type-loader!sentry/components/core/badge';

export default Storybook.story('Badge', (story, APIReference) => {
  APIReference(types.Badge);
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="Badge" /> component is used to display a badge. The{' '}
          <Storybook.JSXProperty name="type" value="default" /> prop is required for all
          badges and determines the color of the badge. The content of the badge is passed
          as
          <Storybook.JSXNode name="children" />.
        </p>
        <Storybook.SideBySide>
          <Badge type="alpha">Alpha</Badge>
          <Badge type="beta">Beta</Badge>
          <Badge type="new">New</Badge>
          <Badge type="experimental">Experimental</Badge>
          <Badge type="default">Default</Badge>
          <Badge type="warning">Warning</Badge>
        </Storybook.SideBySide>
      </Fragment>
    );
  });
});
