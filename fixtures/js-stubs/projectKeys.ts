import {ProjectKey} from 'sentry/types/project';

export function ProjectKeys(params: ProjectKey[] = []): ProjectKey[] {
  return [
    {
      dsn: {
        unreal: '',
        secret:
          'http://188ee45a58094d939428d8585aa6f661:a33bf9aba64c4bbdaf873bb9023b6d2d@dev.getsentry.net:8000/1',
        minidump:
          'http://dev.getsentry.net:8000/api/1/minidump?sentry_key=188ee45a58094d939428d8585aa6f661',
        public: 'http://188ee45a58094d939428d8585aa6f661@dev.getsentry.net:8000/1',
        cdn: 'http://dev.getsentry.net:800/js-sdk-loader/188ee45a58094d939428d8585aa6f661.min.js',
        csp: 'http://dev.getsentry.net:8000/api/1/csp-report/?sentry_key=188ee45a58094d939428d8585aa6f661',
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
      browserSdkVersion: 'latest',
      browserSdk: {
        choices: [
          ['latest', 'latest'],
          ['7.x', '7.x'],
          ['6.x', '6.x'],
          ['5.x', '5.x'],
          ['4.x', '4.x'],
        ],
      },
      dynamicSdkLoaderOptions: {
        hasPerformance: false,
        hasReplay: false,
        hasDebug: false,
      },
    },
    ...params,
  ];
}
