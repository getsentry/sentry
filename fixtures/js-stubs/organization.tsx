import {OrgRoleList, TeamRoleList} from 'sentry-fixture/roleList';

import type {DetailedOrganization} from 'sentry/types';

export function Organization(
  params: Partial<DetailedOrganization> = {}
): DetailedOrganization {
  const slug = params.slug ?? 'org-slug';
  return {
    id: '3',
    slug,
    name: 'Organization Name',
    links: {
      organizationUrl: `https://${slug}.sentry.io`,
      regionUrl: 'https://us.sentry.io',
    },
    access: [
      'org:read',
      'org:write',
      'org:admin',
      'org:integrations',
      'project:read',
      'project:write',
      'project:releases',
      'project:admin',
      'team:read',
      'team:write',
      'team:admin',
      'alerts:read',
      'alerts:write',
    ],
    status: {
      id: 'active',
      name: 'active',
    },
    experiments: {},
    scrapeJavaScript: true,
    features: [],
    onboardingTasks: [],
    aiSuggestedSolution: false,
    alertsMemberWrite: false,
    allowJoinRequests: false,
    allowSharedIssues: false,
    attachmentsRole: '',
    availableRoles: [],
    avatar: {
      avatarType: 'default',
      avatarUuid: null,
      avatarUrl: null,
    },
    codecovAccess: false,
    dataScrubber: false,
    dataScrubberDefaults: false,
    dateCreated: new Date().toISOString(),
    debugFilesRole: '',
    defaultRole: '',
    enhancedPrivacy: false,
    eventsMemberAdmin: false,
    githubOpenPRBot: false,
    githubPRBot: false,
    githubNudgeInvite: false,
    isDefault: false,
    isDynamicallySampled: true,
    isEarlyAdopter: false,
    openMembership: false,
    pendingAccessRequests: 0,
    quota: {
      accountLimit: null,
      maxRate: null,
      maxRateInterval: null,
      projectLimit: null,
    },
    relayPiiConfig: null,
    require2FA: false,
    safeFields: [],
    scrubIPAddresses: false,
    sensitiveFields: [],
    storeCrashReports: 0,
    trustedRelays: [],
    teams: [],
    projects: [],
    ...params,

    orgRoleList: OrgRoleList(),
    teamRoleList: TeamRoleList(),
  };
}
