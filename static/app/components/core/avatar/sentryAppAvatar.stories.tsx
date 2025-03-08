import {Fragment} from 'react';

import {SentryAppAvatar} from 'sentry/components/core/avatar/sentryAppAvatar';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/avatar/sentryAppAvatar';

export default storyBook('SentryAppAvatar', (story, APIReference) => {
  APIReference(types.SentryAppAvatar);
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The SentryAppAvatar component displays an avatar for a user, which can be either
          a gravatar, uploaded image, or letter avatar (initials). It accepts a user
          object and will automatically determine the appropriate avatar type to display
          based on the user's settings and available avatar data.
        </p>
        <SentryAppAvatar
          sentryApp={{
            uuid: '1',
            name: 'Test Sentry App',
            slug: 'test-sentry-app',
            avatars: [],
          }}
        />
      </Fragment>
    );
  });
});
