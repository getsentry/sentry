export function OrganizationEvent(params) {
  return {
    projectID: '2',
    eventID: '12345678901234567890123456789012',
    message: 'ApiException',
    dateCreated: '2018-10-02T19:45:36+00:00',
    user: {
      email: 'billy@sentry.io',
      id: '1',
      username: null,
    },
    ...params,
  };
}
