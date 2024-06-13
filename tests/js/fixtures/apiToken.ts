import type {NewInternalAppApiToken} from 'sentry/types/user';

export function ApiTokenFixture(
  params: Partial<NewInternalAppApiToken> = {}
): NewInternalAppApiToken {
  return {
    id: '1',
    name: 'token_name1',
    token: 'apitoken123',
    dateCreated: new Date('Thu Jan 11 2018 18:01:41 GMT-0800 (PST)').toISOString(),
    scopes: ['project:read', 'project:write'],
    application: null,
    refreshToken: 'refresh_token',
    expiresAt: new Date('Thu Jan 11 2018 18:01:41 GMT-0800 (PST)').toISOString(),
    state: 'active',
    tokenLastCharacters: 'n123',
    ...params,
  };
}
