import type {EntityHeaderProps} from '@sentry/scraps/entityHeader';
import {EntityHeader} from '@sentry/scraps/entityHeader';

const props: EntityHeaderProps = {
  title: {label: 'Replay user', value: 'anonymous@example.com'},
  metadata: {
    label: 'Replay properties',
    items: [
      {label: 'Started at', values: ['Feb 11, 2026 10:56 CET']},
      {label: 'Browser', values: ['Chrome', '144.0.0']},
      {label: 'Operating system', values: ['Windows', '>=10']},
    ],
  },
  stats: {
    label: 'Replay stats',
    items: [
      {type: 'text', label: 'Dead Clicks', value: 0},
      {type: 'text', label: 'Rage Clicks', value: 2},
      {type: 'text', label: 'Errors', value: 1},
    ],
  },
};

describe('EntityHeader', () => {
  // The stats sit beside the title above the `lg` container breakpoint (640px)
  // and drop below the metadata under it. The header establishes its own query
  // container at full width, so the viewport drives the reflow here.
  it.snapshot('stacked', () => <EntityHeader {...props} />, {
    viewport: 480,
    tags: {layout: 'stacked', area: 'core'},
  });

  it.snapshot('side-by-side', () => <EntityHeader {...props} />, {
    viewport: 900,
    tags: {layout: 'side-by-side', area: 'core'},
  });

  it.snapshot('loading', () => <EntityHeader {...props} isLoading />, {
    viewport: 900,
    tags: {state: 'loading', area: 'core'},
  });

  it.snapshot('title only', () => <EntityHeader title={props.title} />, {
    viewport: 900,
    tags: {slots: 'title', area: 'core'},
  });
});
