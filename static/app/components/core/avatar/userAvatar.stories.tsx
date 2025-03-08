import {Fragment} from 'react';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/avatar/userAvatar';

export default storyBook('UserAvatar', (story, APIReference) => {
  APIReference(types.UserAvatar);
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The UserAvatar component displays an avatar for a user, which can be either a
          gravatar, uploaded image, or letter avatar (initials). It accepts a user object
          and will automatically determine the appropriate avatar type to display based on
          the user's settings and available avatar data.
        </p>
        <UserAvatar
          user={{
            id: '1',
            name: 'John Doe',
            email: 'john.doe@example.com',
            avatar: {
              avatarType: 'gravatar',
              avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
              avatarUrl: 'https://sentry.io/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e/',
            },
            ip_address: '127.0.0.1',
            username: 'john.doe',
          }}
        />
      </Fragment>
    );
  });
});
