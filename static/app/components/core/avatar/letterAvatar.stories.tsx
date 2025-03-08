import {Fragment} from 'react';

import {LetterAvatar} from 'sentry/components/core/avatar/letterAvatar';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/avatar/letterAvatar';

export default storyBook('LetterAvatar', (story, APIReference) => {
  APIReference(types.LetterAvatar);
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The ProjectAvatar component displays an avatar for a user, which can be either a
          gravatar, uploaded image, or letter avatar (initials). It accepts a user object
          and will automatically determine the appropriate avatar type to display based on
          the user's settings and available avatar data.
        </p>
        <LetterAvatar displayName="John Doe" identifier="john.doe@example.com" />
      </Fragment>
    );
  });
});
