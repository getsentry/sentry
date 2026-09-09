import * as Sentry from '@sentry/react';
import {ProjectFixture} from 'sentry-fixture/project';

import {screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {
  getEmbedLinkHref,
  renderEmbed,
} from 'sentry/components/seer/markdown/embeds/components/resourceEmbedTestUtils';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

const LOG_ID = '019bfe1c-4c1f-7e3d-9a2f-3e6b1a2c3d4e';
const TRACE_ID = 'a1b2c3d4e5f678901234567890abcdef';
const TIMESTAMP = '2026-08-25T16:37:12Z';
const PROJECT_ID = '2';
const PROJECT_SLUG = 'web';

const ATTRIBUTES: TraceItemResponseAttribute[] = [
  {name: OurLogKnownFieldKey.MESSAGE, type: 'str', value: 'Payment provider timed out'},
  {name: OurLogKnownFieldKey.SEVERITY, type: 'str', value: 'error'},
  {name: OurLogKnownFieldKey.SEVERITY_NUMBER, type: 'int', value: 17},
  {name: OurLogKnownFieldKey.TRACE_ID, type: 'str', value: TRACE_ID},
  {name: 'region', type: 'str', value: 'us-east-1'},
];

function mockLogDetails(attributes = ATTRIBUTES) {
  return MockApiClient.addMockResponse({
    url: `/projects/org-slug/${PROJECT_SLUG}/trace-items/${LOG_ID}/`,
    body: {
      itemId: LOG_ID,
      links: null,
      meta: {},
      timestamp: TIMESTAMP,
      attributes,
    },
  });
}

/** The row the id-only path has to find before it can ask for details. */
function mockLogRowLookup() {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    body: {
      data: [
        {
          [OurLogKnownFieldKey.ID]: LOG_ID,
          [OurLogKnownFieldKey.PROJECT_ID]: PROJECT_ID,
          [OurLogKnownFieldKey.TRACE_ID]: TRACE_ID,
          [OurLogKnownFieldKey.SEVERITY]: 'error',
          [OurLogKnownFieldKey.SEVERITY_NUMBER]: 17,
          [OurLogKnownFieldKey.TIMESTAMP]: TIMESTAMP,
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: String(
            BigInt(new Date(TIMESTAMP).getTime()) * 1_000_000n
          ),
        },
      ],
      meta: {fields: {}, units: {}},
    },
  });
}

function renderLog(data: Record<string, unknown> = {}) {
  return renderEmbed({
    name: 'log',
    data: {
      id: LOG_ID,
      traceId: TRACE_ID,
      projectId: PROJECT_ID,
      timestamp: TIMESTAMP,
      ...data,
    },
  });
}

describe('Seer log embed', () => {
  beforeEach(() => {
    ProjectsStore.loadInitialData([ProjectFixture({id: PROJECT_ID, slug: PROJECT_SLUG})]);
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [Number(PROJECT_ID)],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: null},
    });
  });

  it('links to the single row in Explore, windowed around its timestamp', () => {
    const href = getEmbedLinkHref('log', 'Log 019bfe1c', {
      id: LOG_ID,
      traceId: TRACE_ID,
      projectId: PROJECT_ID,
      timestamp: TIMESTAMP,
    });

    expect(href).toContain('/organizations/org-slug/explore/logs/');
    expect(href).toContain(`logsQuery=id%3A${LOG_ID}`);
    expect(href).toContain(`logsRowId=${LOG_ID}`);
    expect(href).toContain('mode=samples');
    expect(href).toContain('project=2');
    expect(href).toContain('start=2026-08-25T16%3A32%3A12');
    expect(href).toContain('end=2026-08-25T16%3A42%3A12');
  });

  it('renders the severity, message and timestamp of the log', async () => {
    const details = mockLogDetails();

    renderLog();

    expect(await screen.findByText('Payment provider timed out')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByTestId('seer-log-embed')).toBeInTheDocument();
    expect(screen.queryByTestId('seer-log-attributes')).not.toBeInTheDocument();
    expect(details).toHaveBeenCalledWith(
      `/projects/org-slug/${PROJECT_SLUG}/trace-items/${LOG_ID}/`,
      expect.objectContaining({
        query: expect.objectContaining({
          trace_id: TRACE_ID,
          timestamp: new Date(TIMESTAMP).getTime() / 1000,
        }),
      })
    );
  });

  it('renders on a page that never initialized page filters', async () => {
    // Seer renders from the organization layout, so it appears on plenty of
    // pages that mount no PageFiltersContainer -- the stories page among them.
    // `init()` leaves `isReady` false, which is all such a page ever has.
    PageFiltersStore.init();
    const details = mockLogDetails();

    renderLog();

    expect(await screen.findByText('Payment provider timed out')).toBeInTheDocument();
    expect(details).toHaveBeenCalled();
  });

  it('renders the attribute tree for view "attributes"', async () => {
    mockLogDetails();

    renderLog({view: 'attributes'});

    expect(await screen.findByTestId('seer-log-attributes')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-region')).toHaveTextContent('region');
    expect(screen.getByText('us-east-1')).toBeInTheDocument();
    // The message is the summary line, not a tree row.
    expect(screen.getAllByText('Payment provider timed out')).toHaveLength(1);
  });

  it('breaks a single attribute down for view "attribute"', async () => {
    mockLogDetails();
    const aggregates = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {region: 'us-east-1', 'count()': 8},
          {region: 'eu-west-1', 'count()': 2},
        ],
      },
    });

    renderLog({view: 'attribute', attribute: 'region'});

    expect(await screen.findByTestId('seer-log-attribute-breakdown')).toBeInTheDocument();
    expect(await screen.findByText('eu-west-1')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Break down in Explore'})).toHaveAttribute(
      'href',
      expect.stringContaining('mode=aggregate')
    );
    expect(aggregates).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['region', 'count()'],
          orderby: '-count()',
        }),
      })
    );
  });

  it('falls back to the summary when view "attribute" has no key', async () => {
    mockLogDetails();
    const aggregates = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });

    renderLog({view: 'attribute'});

    expect(await screen.findByText('Payment provider timed out')).toBeInTheDocument();
    expect(screen.queryByTestId('seer-log-attribute-breakdown')).not.toBeInTheDocument();
    expect(aggregates).not.toHaveBeenCalled();
  });

  it('resolves the trace and project from the id alone before fetching details', async () => {
    const lookup = mockLogRowLookup();
    const details = mockLogDetails();

    renderEmbed({name: 'log', data: {id: LOG_ID, timestamp: TIMESTAMP}});

    expect(await screen.findByText('Payment provider timed out')).toBeInTheDocument();
    await waitFor(() => {
      expect(lookup).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'ourlogs',
            query: `id:${LOG_ID}`,
            project: [-1],
          }),
        })
      );
    });
    expect(details).toHaveBeenCalled();
  });

  it('points the header link at the project it resolved from the id', async () => {
    mockLogRowLookup();
    mockLogDetails();

    renderEmbed({name: 'log', data: {id: LOG_ID, timestamp: TIMESTAMP}});

    expect(await screen.findByText('Payment provider timed out')).toBeInTheDocument();
    // Without the resolved project the link scopes Explore to My Projects and
    // can miss the row the card just loaded.
    const href = screen
      .getByRole('link', {name: `Log ${LOG_ID.slice(0, 8)}`})
      .getAttribute('href');
    expect(href).toContain(`project=${PROJECT_ID}`);
  });

  it('reports an error for a project this viewer cannot see', async () => {
    // `useTraceItemDetails` needs the project in the store to build its URL, and
    // disables itself without one -- a disabled query must not read as loading.
    ProjectsStore.loadInitialData([ProjectFixture({id: '999', slug: 'other'})]);
    const details = mockLogDetails();
    const captureException = jest
      .spyOn(Sentry, 'captureException')
      .mockImplementation(() => '');

    renderLog();

    expect(await screen.findByText('Unable to load log details')).toBeInTheDocument();
    expect(details).not.toHaveBeenCalled();
    // An inaccessible project is a state the card renders, not an app error.
    expect(captureException).not.toHaveBeenCalled();
  });
});
