import type {ApiAccessScope} from 'sentry/constants/apiAccessScopes';
import {t} from 'sentry/locale';

export {API_ACCESS_SCOPES, type ApiAccessScope} from 'sentry/constants/apiAccessScopes';

type ApiAccessScopeDetails = {
  access: 'admin' | 'manage' | 'read' | 'readWrite';
  resource: string;
};

export const API_ACCESS_SCOPE_DETAILS = {
  'alerts:read': {
    resource: t('Alerts'),
    access: 'read',
  },
  'alerts:write': {
    resource: t('Alerts'),
    access: 'readWrite',
  },
  'event:admin': {
    resource: t('Issues & Events'),
    access: 'admin',
  },
  'event:read': {
    resource: t('Issues & Events'),
    access: 'read',
  },
  'event:write': {
    resource: t('Issues & Events'),
    access: 'readWrite',
  },
  'member:admin': {
    resource: t('Members'),
    access: 'admin',
  },
  'member:read': {
    resource: t('Members'),
    access: 'read',
  },
  'member:write': {
    resource: t('Members'),
    access: 'readWrite',
  },
  'org:admin': {
    resource: t('Organization'),
    access: 'admin',
  },
  'org:ci': {
    resource: t('CI Workflows'),
    access: 'manage',
  },
  'org:integrations': {
    resource: t('Integrations'),
    access: 'admin',
  },
  'org:read': {
    resource: t('Organization'),
    access: 'read',
  },
  'org:write': {
    resource: t('Organization'),
    access: 'readWrite',
  },
  'project:admin': {
    resource: t('Projects'),
    access: 'admin',
  },
  'project:distribution': {
    resource: t('App Distribution'),
    access: 'manage',
  },
  'project:read': {
    resource: t('Projects'),
    access: 'read',
  },
  'project:releases': {
    resource: t('Releases'),
    access: 'admin',
  },
  'project:write': {
    resource: t('Projects'),
    access: 'readWrite',
  },
  'team:admin': {
    resource: t('Teams'),
    access: 'admin',
  },
  'team:read': {
    resource: t('Teams'),
    access: 'read',
  },
  'team:write': {
    resource: t('Teams'),
    access: 'readWrite',
  },
} satisfies Record<ApiAccessScope, ApiAccessScopeDetails>;

export const ALLOWED_SCOPES = [
  'alerts:read',
  'alerts:write',
  'event:admin',
  'event:read',
  'event:write',
  'member:admin',
  'member:invite',
  'member:read',
  'member:write',
  'org:admin',
  'org:billing',
  'org:ci',
  'org:integrations',
  'org:read',
  'org:superuser', // not an assignable API access scope
  'org:write',
  'project:admin',
  'project:distribution',
  'project:read',
  'project:releases',
  'project:write',
  'team:admin',
  'team:read',
  'team:write',
] as const;

export type Scope = (typeof ALLOWED_SCOPES)[number];
