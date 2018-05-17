/**
 * Common constants here
 */

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
  minMatchCharLength: 1,
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
