import type {InternalAppApiToken as InternalAppApiTokenType} from 'sentry/types';

export function ApiToken(
  params: Partial<InternalAppApiTokenType> = {}
): InternalAppApiTokenType {
  return {
    id: '1',
    token: 'apitoken123',
    dateCreated: new Date('Thu Jan 11 2018 18:01:41 GMT-0800 (PST)').toISOString(),
    scopes: ['project:read', 'project:write'],
    application: null,
    refreshToken: 'refresh_token',
    expiresAt: new Date('Thu Jan 11 2018 18:01:41 GMT-0800 (PST)').toISOString(),
    state: 'active',
    ...params,
  };
}
