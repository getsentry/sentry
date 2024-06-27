import type {Broadcast} from 'sentry/types/system';

export function BroadcastFixture(params: Partial<Broadcast> = {}): Broadcast {
  return {
    dateCreated: new Date().toISOString(),
    dateExpires: new Date().toISOString(),
    hasSeen: false,
    id: '8',
    isActive: true,
    cta: 'cta_text',
    link: 'https://docs.sentry.io/clients/javascript/sourcemaps/#uploading-source-maps-to-sentry',
    message:
      'Source maps are JSON files that contain information on how to map your transpiled source code back to their original source.',
    title: 'Learn about Source Maps',
    ...params,
  };
}
