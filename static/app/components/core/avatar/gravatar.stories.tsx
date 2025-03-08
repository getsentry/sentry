import {Fragment} from 'react';

import {Gravatar} from 'sentry/components/core/avatar/gravatar';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/avatar/gravatar';

export default storyBook('Gravatar', (story, APIReference) => {
  APIReference(types.Gravatar);
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The Gravatar component displays an avatar for a user, which can be either a
          gravatar, uploaded image, or letter avatar (initials). It accepts a user object
          and will attempt to fetch and display the user's gravatar from the Gravatar
          service.
        </p>
        <Gravatar remoteSize={120} gravatarId="2d641b5d-8c74-44de-9cb6-fbd54701b35e" />
      </Fragment>
    );
  });
});
