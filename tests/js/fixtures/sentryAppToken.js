export function SentryAppToken(params = {}) {
  return {
    token: '123456123456123456123456-token',
    dateCreated: 'Jul 2, 2019 6:06:59 PM UTC',
    scopes: [],
    refreshToken: '123456123456123456123456-refreshtoken',
    expiresAt: null,
    application: null,
    ...params,
  };
}
