import {Fragment} from 'react';

import {OrganizationAvatar} from 'sentry/components/core/avatar/organizationAvatar';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/avatar/organizationAvatar';

export default storyBook('OrganizationAvatar', (story, APIReference) => {
  APIReference(types.OrganizationAvatar);
  story('Default', () => {
    return (
      <Fragment>
        <p>The OrganizationAvatar component displays an avatar for an organization.</p>
        <OrganizationAvatar
          organization={{
            id: '1',
            slug: 'test-organization',
            avatar: {
              avatarType: 'gravatar',
              avatarUrl: 'https://sentry.io/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e/',
              avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
            },
            codecovAccess: false,
            dateCreated: '2021-01-01',
            features: [],
            githubNudgeInvite: false,
            githubOpenPRBot: false,
            githubPRBot: false,
            hideAiFeatures: false,
            isEarlyAdopter: false,
            issueAlertsThreadFlag: false,
            metricAlertsThreadFlag: false,
            name: 'Test Organization',
            require2FA: false,
            status: {
              id: 'active',
              name: 'Active',
            },
            links: {
              organizationUrl: 'https://sentry.io/test-organization',
              regionUrl: 'https://sentry.io/test-organization',
            },
          }}
        />
      </Fragment>
    );
  });
});
