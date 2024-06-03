import type {NewInternalAppApiToken} from 'sentry/types/user';

export function SentryAppTokenFixture(
  params: Partial<NewInternalAppApiToken> = {}
): NewInternalAppApiToken {
  return {
    token: '123456123456123456123456-token',
    name: 'apptokenname-1',
    dateCreated: '2019-03-02T18:30:26Z',
    scopes: [],
    refreshToken: '123456123456123456123456-refreshtoken',
    expiresAt: '',
    application: null,
    id: '1',
    state: 'active',
    tokenLastCharacters: 'oken',
    ...params,
  };
}
