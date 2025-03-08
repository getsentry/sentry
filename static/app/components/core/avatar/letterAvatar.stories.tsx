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
          The LetterAvatar component displays an avatar for a user, which is a letter
          combination of the user's name or identifier. The color of the avatar is
          determined by the hash of the identifier.
        </p>
        <LetterAvatar displayName="John Doe" identifier="john.doe@example.com" />
      </Fragment>
    );
  });
});
