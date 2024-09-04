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
    mediaUrl: 'https://images.ctfassets.net/em6l9zw4tzag/2vWdw7ZaApWxygugalbyOC/285525e5b7c9fbfa8fb814a69ab214cd/PerformancePageSketches_hero.jpg?w=2520&h=945&q=50&fm=webp',
    category: 'feature',
    ...params,
  };
}
