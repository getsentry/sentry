import {MemoryRouter} from 'react-router';

import type {EntityHeaderProps} from '@sentry/scraps/entityHeader';
import {EntityHeader} from '@sentry/scraps/entityHeader';
import type {TranslationContextValue} from '@sentry/scraps/translation';
import {TranslationContextProvider} from '@sentry/scraps/translation';

const translation: TranslationContextValue = {
  t: (string, ...args) =>
    string.replace('%s', typeof args[0] === 'number' ? String(args[0]) : ''),
  tct: template => template,
};

/**
 * No case here carries an avatar, and none should until the harness loads the
 * app's global stylesheet. `Avatar` sizes itself through `.avatar` in
 * `shared-components.less`, which supplies the `position: relative` its
 * absolutely positioned SVG needs; the harness injects only fonts and
 * extracted emotion, so the avatar escapes its box and renders enormous. It
 * also wants a `QueryClientProvider`, which the harness does not give either.
 */

const props: EntityHeaderProps = {
  title: {type: 'text', label: 'Replay user', value: 'anonymous@example.com'},
  metadata: {
    label: 'Replay properties',
    items: [
      {label: 'Started at', type: 'text', value: 'Feb 11, 2026 10:56 CET'},
      {
        label: 'Browser',
        type: 'text',
        value: 'Chrome',
        secondary: {label: 'version', value: '144.0.0'},
      },
      {
        label: 'Operating system',
        type: 'text',
        value: 'Windows',
        secondary: {label: 'version', value: '>=10'},
      },
    ],
  },
  stats: {
    label: 'Replay stats',
    items: [
      {label: 'Dead Clicks', value: 0},
      {label: 'Rage Clicks', value: 2},
      {label: 'Errors', value: 1},
    ],
  },
};

const toolNames = [
  'search_flights',
  'book_hotel',
  'get_weather',
  'convert_currency',
  'translate',
  'find_restaurants',
  'rent_car',
  'check_visa',
  'plan_route',
  'send_itinerary',
];

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

  it.snapshot(
    'linked and plain stats',
    () => (
      <MemoryRouter>
        <EntityHeader
          title={props.title}
          stats={{
            label: 'Replay stats',
            items: [
              {label: {type: 'link', content: 'Errors', to: '/replays/1/'}, value: 3},
              {label: 'Errors', value: {type: 'link', content: 3, to: '/replays/1/'}},
              {
                label: {type: 'link', content: 'Errors', to: '/replays/1/'},
                value: {type: 'link', content: 3, to: '/issues/'},
              },
              {
                label: {
                  type: 'link',
                  content: 'Errors',
                  to: '/replays/1/',
                  tooltip: 'Why',
                },
                value: {type: 'link', content: 3, to: '/issues/', tooltip: 'Split'},
              },
              {label: 'Errors', value: 3},
            ],
          }}
        />
      </MemoryRouter>
    ),
    {viewport: 900, tags: {area: 'core'}}
  );

  // An empty value keeps the value's typography, so it should sit on the same
  // baseline and row height as the populated stats beside it.
  it.snapshot(
    'empty stats',
    () => (
      <MemoryRouter>
        <EntityHeader
          title={props.title}
          stats={{
            label: 'Build stats',
            items: [
              {label: 'Install Size', value: '12 MB'},
              {label: 'Cost', value: null},
              {label: {type: 'link', content: 'Errors', to: '/replays/1/'}, value: null},
              {
                label: 'Issues',
                value: {type: 'link', content: null, to: '/issues/'},
              },
              {
                label: 'Download Size',
                value: {
                  type: 'text',
                  content: null,
                  tooltip: 'Not reported for this platform',
                },
              },
            ],
          }}
        />
      </MemoryRouter>
    ),
    {viewport: 900, tags: {state: 'empty', area: 'core'}}
  );

  describe.each([480, 900])('late metadata at %s', viewport => {
    it.snapshot.each([true, false])(
      'loading %s',
      isLoading => (
        <EntityHeader
          title={props.title}
          isLoading={isLoading}
          metadata={{
            label: 'Replay properties',
            items: [
              isLoading ? null : {label: 'Started at', type: 'text', value: '2h ago'},
              isLoading ? null : {label: 'Browser', type: 'text', value: 'Chrome'},
            ],
          }}
          stats={{
            label: 'Replay stats',
            items: [{label: 'Errors', value: 0}],
          }}
        />
      ),
      isLoading => ({
        viewport,
        tags: {state: isLoading ? 'loading' : 'loaded', area: 'core'},
      })
    );
  });

  // Past `maxVisible` the entries collapse into "+N more"; the rest wrap onto
  // further lines rather than overflow a narrow header, under a label that
  // stays on the first line. The harness renders on the server, where there is
  // no container to measure, so `maxVisible` resolves to its `zero` value at
  // every width.
  it.snapshot.each([480, 900])(
    'metadata list at %s',
    () => (
      // The harness mounts no translation provider, and the context's default
      // `t` does not interpolate.
      <TranslationContextProvider value={translation}>
        <EntityHeader
          title={{type: 'text', label: 'Conversation', value: 'Trip planning'}}
          metadata={{
            label: 'Conversation properties',
            items: [
              {label: 'Model', type: 'text', value: 'gpt-5', mode: 'full'},
              {
                label: 'Tools',
                type: 'list',
                mode: 'full',
                maxVisible: {zero: 6, md: 8},
                items: toolNames.map(name => ({
                  key: name,
                  label: 'Tool',
                  type: 'text',
                  value: name,
                  variant: name === 'book_hotel' ? 'danger' : undefined,
                })),
              },
              {label: 'Started at', type: 'text', value: '2h ago'},
            ],
          }}
        />
      </TranslationContextProvider>
    ),
    viewport => ({viewport, tags: {area: 'core'}})
  );

  // A value wider than the header truncates, so the pipe after it follows the
  // text that shows rather than landing on top of it.
  it.snapshot(
    'long value',
    () => (
      <EntityHeader
        title={{type: 'text', label: 'Conversation', value: 'Trip planning'}}
        metadata={{
          label: 'Conversation properties',
          items: [
            {
              label: 'Model',
              type: 'text',
              mode: 'full',
              value: 'anthropic/claude-opus-very-long-model-identifier-2026',
            },
            {label: 'Started at', type: 'text', value: '2h ago'},
          ],
        }}
      />
    ),
    {viewport: 240, tags: {area: 'core'}}
  );
});
