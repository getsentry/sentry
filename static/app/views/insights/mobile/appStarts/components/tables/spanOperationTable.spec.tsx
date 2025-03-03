import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanOperationTable} from 'sentry/views/insights/mobile/appStarts/components/tables/spanOperationTable';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useLocation');

describe('SpanOpSelector', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  let mockEventsRequest: jest.Mock;

  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
    selection: {
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
      environments: [],
      projects: [parseInt(project.id, 10)],
    },
  });

  jest.mocked(useLocation).mockReturnValue(LocationFixture());

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    mockEventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        meta: {
          fields: {
            'project.id': 'integer',
            'span.op': 'string',
            'span.description': 'string',
            'span.group': 'string',
            'avg_if(span.self_time,release,release1)': 'duration',
            'avg_compare(span.self_time,release,release1,release2)': 'percent_change',
            'count()': 'integer',
            'avg_if(span.self_time,release,release2)': 'duration',
            'sum(span.self_time)': 'duration',
          },
        },
        data: [
          {
            'project.id': parseInt(project.id, 10),
            'span.op': 'app.start.warm',
            'span.description': 'Application Init',
            'span.group': '7f4be68f08c0455f',
            'avg_if(span.self_time,release,release1)': 22.549867,
            'avg_compare(span.self_time,release,release1,release2)': 0.5,
            'count()': 14,
            'avg_if(span.self_time,release,release2)': 12504.931908384617,
            'sum(span.self_time)': 162586.66467600001,
          },
        ],
      },
    });
  });

  it('renders data properly', async function () {
    render(
      <SpanOperationTable
        transaction="foo-bar"
        primaryRelease="release1"
        secondaryRelease="release2"
      />
    );

    expect(await screen.findByRole('link', {name: 'Operation'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Span Description'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Avg Duration (R1)'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Avg Duration (R2)'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Change'})).toBeInTheDocument();

    expect(await screen.findByRole('cell', {name: 'app.start.warm'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Application Init'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '22.55ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '12.50s'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '+50%'})).toBeInTheDocument();

    expect(screen.getByRole('link', {name: 'Application Init'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/insights/mobile/app-startup/spans/?spanDescription=Application%20Init&spanGroup=7f4be68f08c0455f&spanOp=app.start.warm&transaction=foo-bar'
    );
  });

  it('displays the infinity symbol for new spans with null percent change', async function () {
    mockEventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        meta: {
          fields: {
            'project.id': 'integer',
            'span.op': 'string',
            'span.description': 'string',
            'span.group': 'string',
            'avg_if(span.self_time,release,release1)': 'duration',
            'avg_compare(span.self_time,release,release1,release2)': 'percent_change',
            'count()': 'integer',
            'avg_if(span.self_time,release,release2)': 'duration',
            'sum(span.self_time)': 'duration',
          },
        },
        data: [
          {
            'project.id': parseInt(project.id, 10),
            'span.op': 'app.start.warm',
            'span.description': 'Application Init',
            'span.group': '7f4be68f08c0455f',
            'count()': 14,
            'sum(span.self_time)': 162586.66467600001,

            // simulate a scenario where a span was added in release 2
            'avg_if(span.self_time,release,release1)': 0,
            'avg_if(span.self_time,release,release2)': 12504.931908384617,
            'avg_compare(span.self_time,release,release1,release2)': null,
          },
        ],
      },
    });

    render(
      <SpanOperationTable
        transaction="foo-bar"
        primaryRelease="release1"
        secondaryRelease="release2"
      />
    );

    expect(await screen.findByRole('cell', {name: '+∞%'})).toBeInTheDocument();
  });

  it('modifies the request to events when a span operation is selected', async function () {
    // Mock useLocation to simulate the span op query param
    jest.mocked(useLocation).mockReturnValue(
      LocationFixture({
        query: {
          'span.op': 'app.start.cold',
        },
      })
    );

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        meta: {
          fields: {
            'span.op': 'string',
            'count()': 'integer',
          },
        },
        data: [
          {
            'span.op': 'app.start.cold',
            'count()': 1,
          },
        ],
      },
      match: [
        function (_url: string, options: Record<string, any>) {
          return options?.query?.referrer === 'api.starfish.get-span-operations';
        },
      ],
    });

    render(
      <SpanOperationTable
        transaction="foo-bar"
        primaryRelease="release1"
        secondaryRelease="release2"
      />
    );

    await waitFor(function () {
      expect(mockEventsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('span.op:app.start.cold'),
          }),
        })
      );
    });
  });
});
