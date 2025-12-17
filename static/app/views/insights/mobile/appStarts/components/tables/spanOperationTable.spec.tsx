import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanOperationTable} from 'sentry/views/insights/mobile/appStarts/components/tables/spanOperationTable';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = jest.mocked(useLocation);

describe('SpanOpSelector', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  let mockEventsRequest: jest.Mock;

  jest.mocked(usePageFilters).mockReturnValue(
    PageFilterStateFixture({
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
    })
  );

  jest.mocked(useLocation).mockReturnValue(LocationFixture());

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    mockUseLocation.mockReturnValue(
      LocationFixture({pathname: `/${DOMAIN_VIEW_BASE_URL}/${MOBILE_LANDING_SUB_PATH}`})
    );

    mockEventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        meta: {
          fields: {
            'project.id': 'integer',
            'span.op': 'string',
            'span.description': 'string',
            'span.group': 'string',
            'avg(span.self_time)': 'duration',
            'count()': 'integer',
            'sum(span.self_time)': 'duration',
          },
        },
        data: [
          {
            'project.id': parseInt(project.id, 10),
            'span.op': 'app.start.warm',
            'span.description': 'Application Init',
            'span.group': '7f4be68f08c0455f',
            'avg(span.self_time)': 22.549867,
            'count()': 14,
            'sum(span.self_time)': 162586.66467600001,
          },
        ],
      },
    });
  });

  it('renders data properly', async () => {
    render(<SpanOperationTable transaction="foo-bar" primaryRelease="release1" />);

    expect(await screen.findByRole('link', {name: 'Operation'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Span Description'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Avg Duration'})).toBeInTheDocument();

    expect(await screen.findByRole('cell', {name: 'app.start.warm'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Application Init'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '22.55ms'})).toBeInTheDocument();

    expect(screen.getByRole('link', {name: 'Application Init'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/insights/mobile/mobile-vitals/details/?spanDescription=Application%20Init&spanGroup=7f4be68f08c0455f&spanOp=app.start.warm&transaction=foo-bar'
    );
  });

  it('modifies the request to events when a span operation is selected', async () => {
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
          return options?.query?.referrer === 'api.insights.get-span-operations';
        },
      ],
    });

    render(<SpanOperationTable transaction="foo-bar" primaryRelease="release1" />);

    await waitFor(() => {
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
