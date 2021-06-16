export function SentryAppToken(params = {}) {
  return {
    token: '123456123456123456123456-token',
    dateCreated: '2019-03-02T18:30:26Z',
    scopes: [],
    refreshToken: '123456123456123456123456-refreshtoken',
    expiresAt: null,
    application: null,
    ...params,
  };
}
