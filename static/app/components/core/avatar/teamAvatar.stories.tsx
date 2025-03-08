import {Fragment} from 'react';

import {TeamAvatar} from 'sentry/components/core/avatar/teamAvatar';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/avatar/teamAvatar';

export default storyBook('TeamAvatar', (story, APIReference) => {
  APIReference(types.TeamAvatar);
  story('Default', () => {
    return (
      <Fragment>
        <p>The TeamAvatar component displays an avatar for a team.</p>
        <TeamAvatar
          team={{
            id: '1',
            name: 'Test Team',
            slug: 'test-team',
            avatar: {
              avatarType: 'gravatar',
              avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
              avatarUrl: 'https://sentry.io/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e/',
            },
            access: ['team:read'],
            externalTeams: [],
            hasAccess: true,
            isMember: true,
            memberCount: 1,
            isPending: false,
            teamRole: 'member',
            flags: {
              'idp:provisioned': false,
            },
          }}
        />
      </Fragment>
    );
  });
});
