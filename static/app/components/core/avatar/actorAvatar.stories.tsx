import {Fragment} from 'react';

import {ActorAvatar} from 'sentry/components/core/avatar/actorAvatar';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/avatar/actorAvatar';

export default storyBook('ActorAvatar', (story, APIReference) => {
  APIReference(types.ActorAvatar);
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The ActorAvatar component displays an avatar for a user, which can be either a
          gravatar, uploaded image, or letter avatar (initials). It accepts a user object
          and will automatically determine the appropriate avatar type to display based on
          the user's settings and available avatar data.
        </p>
        <ActorAvatar actor={{type: 'user', id: '1', name: 'John Doe'}} />
      </Fragment>
    );
  });
});
