export function Broadcast(params = {}) {
  return {
    dateCreated: new Date(),
    dateExpires: new Date(),
    hasSeen: false,
    id: '8',
    isActive: true,
    link:
      'https://docs.sentry.io/clients/javascript/sourcemaps/#uploading-source-maps-to-sentry',
    message:
      'Source maps are JSON files that contain information on how to map your transpiled source code back to their original source.',
    title: 'Learn about Source Maps',
    ...params,
  };
}
