export function UpdateSdkAndEnableIntegrationSuggestion() {
  return {
    id: '123',
    sdk: {
      name: 'sentry.python',
      version: '0.1.0',
    },
    sdkUpdates: [
      {
        enables: [
          {
            type: 'enableIntegration',
            enables: [],
            integrationName: 'django',
            integrationUrl: 'https://docs.sentry.io/platforms/python/django/',
          },
        ],
        newSdkVersion: '0.9.0',
        sdkName: 'sentry.python',
        sdkUrl: null,
        type: 'updateSdk',
      },
    ],
  };
}
