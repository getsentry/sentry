import {Fragment} from 'react';

import {DocIntegrationAvatar} from 'sentry/components/core/avatar/docIntegrationAvatar';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/avatar/docIntegrationAvatar';

export default storyBook('DocIntegrationAvatar', (story, APIReference) => {
  APIReference(types.DocIntegrationAvatar);
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The DocIntegrationAvatar component displays an avatar for a doc integration,
          which can be either a gravatar, uploaded image, or letter avatar (initials). It
          accepts a doc integration object and will automatically determine the
          appropriate avatar type to display based on the doc integration's settings and
          available avatar data.
        </p>
        <DocIntegrationAvatar
          docIntegration={{
            slug: 'test-doc-integration',
            name: 'Test Doc Integration',
            avatar: {
              avatarType: 'letter_avatar',
              avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
              avatarUrl: 'https://sentry.io/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e/',
            },
            author: 'John Doe',
            description: 'Test Doc Integration',
            isDraft: false,
            popularity: 0,
            url: 'https://sentry.io/test-doc-integration',
          }}
        />
      </Fragment>
    );
  });
});
