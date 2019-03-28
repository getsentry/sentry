/**
 * Common constants here
 */

import {t} from 'app/locale';

export const API_SCOPES = [
  'project:read',
  'project:write',
  'project:admin',
  'project:releases',
  'team:read',
  'team:write',
  'team:admin',
  'event:read',
  'event:admin',
  'org:read',
  'org:write',
  'org:admin',
  'member:read',
  'member:admin',
];

// Default API scopes when adding a new API token or org API token
export const DEFAULT_API_SCOPES = [
  'event:read',
  'event:admin',
  'project:read',
  'project:releases',
  'org:read',
  'team:read',
  'member:read',
];

// We expose permissions for Sentry Apps in a more resource-centric way.
// All of the API_SCOPES from above should be represented in a more
// User-friendly way here.
export const SENTRY_APP_PERMISSIONS = [
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

export const CSRF_COOKIE_NAME = window.csrfCookieName || 'sc';

export const ALL_ENVIRONMENTS_KEY = '__all_environments__';

// See http://fusejs.io/ for more information
export const DEFAULT_FUSE_OPTIONS = {
  includeScore: true,
  includeMatches: true,
  threshold: 0.4,
  location: 0,
  distance: 75,
  maxPatternLength: 24,
  minMatchCharLength: 2,
  // tokenize: true,
  // findAllMatches: true,
};

// Maps a `type: string` -> `url-prefix: string`
export const AVATAR_URL_MAP = {
  team: 'team-avatar',
  organization: 'organization-avatar',
  project: 'project-avatar',
  user: 'avatar',
};

export const MENU_CLOSE_DELAY = 200;

export const DEFAULT_STATS_PERIOD = '14d';

export const DEFAULT_USE_UTC = true;

export const DEFAULT_RELATIVE_PERIODS = {
  '24h': t('Last 24 hours'),
  '7d': t('Last 7 days'),
  '14d': t('Last 14 days'),
  '30d': t('Last 30 days'),
  '90d': t('Last 90 days'),
};

// Special Search characters
export const NEGATION_OPERATOR = '!';
export const SEARCH_WILDCARD = '*';

// Algolia documentation searchl
export const ALGOLIA_APP_ID = 'OOK48W9UCL';
export const ALGOLIA_READ_ONLY = '2d64ec1106519cbc672d863b0d200782';
export const ALGOLIA_DOCS_INDEX = 'sentry-docs';
export const ALGOLIA_ZENDESK_INDEX = 'zendesk_sentry_articles';

export const RECENT_SEARCH_TYPES = {
  ISSUE: 0,
  EVENT: 1,
};
export const MAX_RECENT_SEARCHES = 3;
