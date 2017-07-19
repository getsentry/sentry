import authorize from 'oauth2-implicit'

const credentials = authorize({
  auth_uri: 'http://dev.getsentry.net:8000/oauth/authorize',
  client_id: '49ebdc3013aa4ac08c7e811201b3a0ac36bf8fe3bcb648cf976ed57a320bbd68',
  scope: ['project:releases', 'event:read', 'org:read', 'org:write'],
  state: {
    location: window.location
  },
});
