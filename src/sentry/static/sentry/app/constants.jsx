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

export const DEFAULT_TOAST_DURATION = 2000;
