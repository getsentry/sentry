/* global process */

import {t} from 'sentry/locale';
import {DataCategory, Scope} from 'sentry/types';

/**
 * Common constants here
 */

// This is the element id where we render our React application to
export const ROOT_ELEMENT = 'blk_router';

// This is considered the "default" route/view that users should be taken
// to when the application does not have any further context
//
// e.g. loading app root or switching organization
export const DEFAULT_APP_ROUTE = '/organizations/:orgSlug/issues/';

export const API_ACCESS_SCOPES = [
  'project:read',
  'project:write',
  'project:admin',
  'project:releases',
  'team:read',
  'team:write',
  'team:admin',
  'event:read',
  'event:write',
  'event:admin',
  'org:read',
  'org:write',
  'org:admin',
  'org:integrations',
  'member:read',
  'member:write',
  'member:admin',
  'alerts:read',
  'alerts:write',
] as const;

// Default API scopes when adding a new API token or org API token
export const DEFAULT_API_ACCESS_SCOPES = [
  'event:read',
  'event:admin',
  'project:read',
  'project:releases',
  'org:read',
  'team:read',
  'member:read',
];

// These should only be used in the case where we cannot obtain roles through
// the members endpoint (primarily in cases where a user is admining a
// different organization they are not a OrganizationMember of ).
export const MEMBER_ROLES = [
  {
    id: 'member',
    name: 'Member',
    allowed: true,
    desc: 'Members can view and act on events, as well as view most other data within the organization.',
  },
  {
    id: 'admin',
    name: 'Admin',
    allowed: true,
    desc: "Admin privileges on any teams of which they're a member. They can create new teams and projects, as well as remove teams and projects on which they already hold membership (or all teams, if open membership is enabled). Additionally, they can manage memberships of teams that they are members of. They cannot invite members to the organization.",
  },
  {
    id: 'manager',
    name: 'Manager',
    allowed: true,
    desc: 'Gains admin access on all teams as well as the ability to add and remove members.',
  },
  {
    id: 'owner',
    name: 'Organization Owner',
    allowed: true,
    desc: 'Unrestricted access to the organization, its data, and its settings. Can add, modify, and delete projects and members, as well as make billing and plan changes.',
  },
];

export type PermissionChoice = {
  label: 'No Access' | 'Read' | 'Read & Write' | 'Admin';
  scopes: Scope[];
};
type PermissionObj = {
  choices: {
    admin: PermissionChoice;
    'no-access': PermissionChoice;
    read?: PermissionChoice;
    write?: PermissionChoice;
  };
  help: string;
  resource: 'Project' | 'Team' | 'Release' | 'Event' | 'Organization' | 'Member';
  label?: string;
};

export const RELEASE_ADOPTION_STAGES = ['low_adoption', 'adopted', 'replaced'];

// We expose permissions for Sentry Apps in a more resource-centric way.
// All of the API_ACCESS_SCOPES from above should be represented in a more
// User-friendly way here.
export const SENTRY_APP_PERMISSIONS: PermissionObj[] = [
  {
    resource: 'Project',
    help: 'Projects, Tags, Debug Files, and Feedback',
    choices: {
      'no-access': {label: 'No Access', scopes: []},
      read: {label: 'Read', scopes: ['project:read']},
      write: {label: 'Read & Write', scopes: ['project:read', 'project:write']},
      admin: {label: 'Admin', scopes: ['project:read', 'project:write', 'project:admin']},
    },
  },
  {
    resource: 'Team',
    help: 'Teams of members',
    choices: {
      'no-access': {label: 'No Access', scopes: []},
      read: {label: 'Read', scopes: ['team:read']},
      write: {label: 'Read & Write', scopes: ['team:read', 'team:write']},
      admin: {label: 'Admin', scopes: ['team:read', 'team:write', 'team:admin']},
    },
  },
  {
    resource: 'Release',
    help: 'Releases, Commits, and related Files',
    choices: {
      'no-access': {label: 'No Access', scopes: []},
      admin: {label: 'Admin', scopes: ['project:releases']},
    },
  },
  {
    resource: 'Event',
    label: 'Issue & Event',
    help: 'Issues, Events, and workflow statuses',
    choices: {
      'no-access': {label: 'No Access', scopes: []},
      read: {label: 'Read', scopes: ['event:read']},
      write: {label: 'Read & Write', scopes: ['event:read', 'event:write']},
      admin: {label: 'Admin', scopes: ['event:read', 'event:write', 'event:admin']},
    },
  },
  {
    resource: 'Organization',
    help: 'Manage Organizations, resolve IDs, retrieve Repositories and Commits',
    choices: {
      'no-access': {label: 'No Access', scopes: []},
      read: {label: 'Read', scopes: ['org:read']},
      write: {label: 'Read & Write', scopes: ['org:read', 'org:write']},
      admin: {label: 'Admin', scopes: ['org:read', 'org:write', 'org:admin']},
    },
  },
  {
    resource: 'Member',
    help: 'Manage Members within Teams',
    choices: {
      'no-access': {label: 'No Access', scopes: []},
      read: {label: 'Read', scopes: ['member:read']},
      write: {label: 'Read & Write', scopes: ['member:read', 'member:write']},
      admin: {label: 'Admin', scopes: ['member:read', 'member:write', 'member:admin']},
    },
  },
];

export const DEFAULT_TOAST_DURATION = 6000;
export const DEFAULT_DEBOUNCE_DURATION = 300;

export const ALL_ENVIRONMENTS_KEY = '__all_environments__';

// Maps a `type: string` -> `url-prefix: string`
export const AVATAR_URL_MAP = {
  team: 'team-avatar',
  organization: 'organization-avatar',
  project: 'project-avatar',
  user: 'avatar',
  sentryAppColor: 'sentry-app-avatar',
  sentryAppSimple: 'sentry-app-avatar',
  docIntegration: 'doc-integration-avatar',
};

export const MENU_CLOSE_DELAY = 200;

export const MAX_PICKABLE_DAYS = 90;

export const DEFAULT_STATS_PERIOD = '14d';

export const DEFAULT_QUERY = 'is:unresolved';

export const DEFAULT_USE_UTC = true;

export const DEFAULT_RELATIVE_PERIODS = {
  '1h': t('Last hour'),
  '24h': t('Last 24 hours'),
  '7d': t('Last 7 days'),
  '14d': t('Last 14 days'),
  '30d': t('Last 30 days'),
  '90d': t('Last 90 days'),
};

export const DEFAULT_RELATIVE_PERIODS_PAGE_FILTER = {
  '1h': t('1H'),
  '24h': t('24H'),
  '7d': t('7D'),
  '14d': t('14D'),
  '30d': t('30D'),
};

export const DATA_CATEGORY_NAMES = {
  [DataCategory.ERRORS]: t('Errors'),
  [DataCategory.TRANSACTIONS]: t('Transactions'),
  [DataCategory.ATTACHMENTS]: t('Attachments'),
};

// Special Search characters
export const NEGATION_OPERATOR = '!';
export const SEARCH_WILDCARD = '*';

// SmartSearchBar settings
export const MAX_AUTOCOMPLETE_RECENT_SEARCHES = 3;
export const MAX_AUTOCOMPLETE_RELEASES = 5;

export const DEFAULT_PER_PAGE = 50;

// Limit query length so paginated response headers don't
// go over HTTP header size limits (4Kb)
export const MAX_QUERY_LENGTH = 400;

// Webpack configures DEPLOY_PREVIEW_CONFIG for deploy preview builds.
export const DEPLOY_PREVIEW_CONFIG = process.env.DEPLOY_PREVIEW_CONFIG as unknown as
  | undefined
  | {
      branch: string;
      commitSha: string;
      githubOrg: string;
      githubRepo: string;
    };

// Webpack configures EXPERIMENTAL_SPA.
export const EXPERIMENTAL_SPA = process.env.EXPERIMENTAL_SPA as unknown as
  | undefined
  | boolean;

// so we don't use filtered values in certain display contexts
// TODO(kmclb): once relay is doing the scrubbing, the masking value will be dynamic,
// so this will have to change
export const FILTER_MASK = '[Filtered]';

// Errors that may occur during the fetching of organization details
export const ORGANIZATION_FETCH_ERROR_TYPES = {
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  ORG_NO_ACCESS: 'ORG_NO_ACCESS',
};

export const CONFIG_DOCS_URL = 'https://develop.sentry.dev/config/';
export const DISCOVER2_DOCS_URL = 'https://docs.sentry.io/product/discover-queries/';

export const IS_ACCEPTANCE_TEST = !!process.env.IS_ACCEPTANCE_TEST;
export const NODE_ENV = process.env.NODE_ENV;
export const DISABLE_RR_WEB = !!process.env.DISABLE_RR_WEB;
export const SPA_DSN = process.env.SPA_DSN;
export const SENTRY_RELEASE_VERSION = process.env.SENTRY_RELEASE_VERSION;

export const DEFAULT_ERROR_JSON = {
  detail: t('Unknown error. Please try again.'),
};
