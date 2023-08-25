import {InternalAppApiToken} from 'sentry/types';

export function SentryAppToken(
  params: Partial<InternalAppApiToken> = {}
): InternalAppApiToken {
  return {
    token: '123456123456123456123456-token',
    dateCreated: '2019-03-02T18:30:26Z',
    scopes: [],
    refreshToken: '123456123456123456123456-refreshtoken',
    expiresAt: '',
    application: null,
    id: '1',
    state: 'active',
    ...params,
  };
}
