export function SentryAppInstallation(params = {}) {
  return {
    uuid: 'd950595e-cba2-46f6-8a94-b79e42806f98',
    app: {
      slug: 'sample-app',
      uuid: 'f4d972ba-1177-4974-943e-4800fe8c7d05',
    },
    organization: {
      slug: 'the-best-org',
    },
    status: 'installed',
    ...params,
  };
}
