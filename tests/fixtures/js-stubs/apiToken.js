export function ApiToken(params = {}) {
  return {
    token: 'apitoken123',
    dateCreated: new Date('Thu Jan 11 2018 18:01:41 GMT-0800 (PST)'),
    scopes: ['scope1', 'scope2'],
    ...params,
  };
}
