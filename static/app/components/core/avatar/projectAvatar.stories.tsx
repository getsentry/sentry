import {Fragment} from 'react';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/avatar/projectAvatar';

export default storyBook('ProjectAvatar', (story, APIReference) => {
  APIReference(types.ProjectAvatar);
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The ProjectAvatar component displays an avatar for a user, which can be either a
          gravatar, uploaded image, or letter avatar (initials). It accepts a user object
          and will automatically determine the appropriate avatar type to display based on
          the user's settings and available avatar data.
        </p>
        <ProjectAvatar
          project={{
            id: '1',
            slug: 'test-project',
          }}
        />
      </Fragment>
    );
  });
});
