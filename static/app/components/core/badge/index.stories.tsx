import {Fragment} from 'react';

import {Badge} from 'sentry/components/core/badge';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/badge';

export default storyBook('Badge', (story, APIReference) => {
  APIReference(types.Badge);
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="Badge" /> component is used to display a badge. The{' '}
          <JSXProperty name="type" value="default" /> prop is required for all badges and
          determines the color of the badge. The content of the badge is passed as
          <JSXNode name="children" />.
        </p>
        <SideBySide>
          <Badge type="alpha">Alpha</Badge>
          <Badge type="beta">Beta</Badge>
          <Badge type="new">New</Badge>
          <Badge type="experimental">Experimental</Badge>
          <Badge type="default">Default</Badge>
          <Badge type="warning">Warning</Badge>
        </SideBySide>
      </Fragment>
    );
  });
});
