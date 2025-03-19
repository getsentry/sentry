import {Fragment} from 'react';

import {DocIntegrationAvatar} from 'sentry/components/core/avatar/docIntegrationAvatar';
import {OrganizationAvatar} from 'sentry/components/core/avatar/organizationAvatar';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {SentryAppAvatar} from 'sentry/components/core/avatar/sentryAppAvatar';
import {TeamAvatar} from 'sentry/components/core/avatar/teamAvatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/avatar/projectAvatar';

export default storyBook('Avatar', (story, APIReference) => {
  APIReference(types.Avatar);
  story('User', () => {
    return (
      <Fragment>
        <p>
          The <code>{'<Avatar user={user} />'}</code> component displays an avatar for a
          user.
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
  story('Team', () => {
    return (
      <Fragment>
        <p>
          The <code>{'<Avatar team={team} />'}</code> component displays an avatar for a
          team.
        </p>
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
  story('Project', () => {
    return (
      <Fragment>
        <p>
          The <code>{'<Avatar project={project} />'}</code> component displays an avatar
          for a project.
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
  story('Organization', () => {
    return (
      <Fragment>
        <p>
          The <code>{'<Avatar organization={organization} />'}</code> component displays
          an avatar for an organization.
        </p>
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
  story('SentryApp', () => {
    return (
      <Fragment>
        <p>
          The <code>{'<Avatar sentryApp={sentryApp} />'}</code> component displays an
          avatar for a SentryApp.
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
  story('DocIntegration', () => {
    return (
      <Fragment>
        <p>
          The <code>{'<Avatar docIntegration={docIntegration} />'}</code> component
          displays an avatar for a doc integration.
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
