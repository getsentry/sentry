import type {DocIntegration} from 'sentry/types/integrations';
import type {OrganizationSummary, Team} from 'sentry/types/organization';
import type {AvatarUser} from 'sentry/types/user';

export const USER: AvatarUser = {
  id: '1',
  name: 'John Doe',
  email: 'john.doe@sentry.io',
  avatar: {
    avatarType: 'gravatar',
    avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
    avatarUrl: 'https://sentry.io/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e/',
  },
  ip_address: '127.0.0.1',
  username: 'john.doe',
};

export const ORGANIZATION: OrganizationSummary = {
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
  githubPRBot: false,
  gitlabPRBot: false,
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
};

export const TEAM: Team = {
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
};

export const PROJECT = {
  id: '1',
  slug: 'test-project',
};

export const SENTRY_APP = {
  uuid: '1',
  name: 'Test Sentry App',
  slug: 'test-sentry-app',
  avatars: [],
};

export const DOC_INTEGRATION: DocIntegration = {
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
};

export const PREVIEW_SIZE = 40;
