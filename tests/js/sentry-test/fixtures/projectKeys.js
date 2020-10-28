export function ProjectKeys(params = []) {
  return [
    {
      dsn: {
        secret:
          'http://188ee45a58094d939428d8585aa6f661:a33bf9aba64c4bbdaf873bb9023b6d2d@dev.getsentry.net:8000/1',
        minidump:
          'http://dev.getsentry.net:8000/api/1/minidump?sentry_key=188ee45a58094d939428d8585aa6f661',
        public: 'http://188ee45a58094d939428d8585aa6f661@dev.getsentry.net:8000/1',
        csp:
          'http://dev.getsentry.net:8000/api/1/csp-report/?sentry_key=188ee45a58094d939428d8585aa6f661',
        security:
          'http://dev.getsentry.net:8000/api/1/security-report/?sentry_key=188ee45a58094d939428d8585aa6f661',
      },
      public: '188ee45a58094d939428d8585aa6f661',
      secret: 'a33bf9aba64c4bbdaf873bb9023b6d2d',
      name: 'Natural Halibut',
      rateLimit: null,
      projectId: 1,
      dateCreated: '2018-02-28T07:13:51.087Z',
      id: '188ee45a58094d939428d8585aa6f661',
      isActive: true,
      label: 'Natural Halibut',
    },
    ...params,
  ];
}
