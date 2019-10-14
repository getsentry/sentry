export function User(params = {}) {
  return {
    id: '1',
    username: 'foo@example.com',
    email: 'foo@example.com',
    name: 'Foo Bar',
    isAuthenticated: true,
    options: {
      timezone: 'UTC',
    },
    hasPasswordAuth: true,
    flags: {
      newsletter_consent_prompt: false,
    },
    ...params,
  };
}
