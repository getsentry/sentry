// write some tests for the DetailsWidgetVisualization component

import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DetailsWidgetVisualization} from 'sentry/views/dashboards/widgets/detailsWidget/detailsWidgetVisualization';
import type {DefaultDetailWidgetFields} from 'sentry/views/dashboards/widgets/detailsWidget/types';
import type {SpanResponse} from 'sentry/views/insights/types';

type TestSpan = Pick<SpanResponse, DefaultDetailWidgetFields>;

describe('DetailsWidgetVisualization', () => {
  beforeEach(() => {
    PageFiltersStore.reset();
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
    const organization = OrganizationFixture();
    const project = ProjectFixture();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            project: project.slug,
            span_id: '123',
            'span.description': 'SELECT * FROM users',
          },
        ],
      },
      match: [MockApiClient.matchQuery({referrer: 'api.insights.span-description'})],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            project: project.slug,
            span_id: '123',
            'span.domain': 'sentry.io',
          },
        ],
      },
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.dashboards.details-widget.domain-status',
        }),
      ],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders a span', () => {
    const span: TestSpan = {
      id: '123',
      'span.op': 'span_op',
      'span.description': 'span_description',
      'span.group': 'span_group',
      'span.category': 'span_category',
      'project.id': 1,
    };
    render(<DetailsWidgetVisualization span={span} />);
    expect(
      screen.getByText(`${span['span.op']} - ${span['span.description']}`)
    ).toBeInTheDocument();
  });

  it.each(['span_group', '', null])(
    'renders the selected db span and source with span.group=%s',
    async spanGroup => {
      const organization = OrganizationFixture();
      const request = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        body: {
          data: [
            {
              'span.description': 'SELECT * FROM users',
              'code.filepath': '/app/views/users.py',
              'code.lineno': 78,
            },
          ],
        },
        match: [MockApiClient.matchQuery({query: 'id:123'})],
      });
      const span: TestSpan = {
        id: '123',
        'span.op': 'db',
        'span.description': 'SELECT USERS FRO*',
        'span.group': spanGroup,
        'span.category': 'db',
        'project.id': 1,
      };
      render(<DetailsWidgetVisualization span={span} />);

      const queryCodeSnippet = await screen.findByText(/select \* from users/i);
      expect(queryCodeSnippet).toHaveClass('language-sql');
      expect(
        screen.getByText(textWithMarkupMatcher('/app/views/users.py at line 78'))
      ).toBeInTheDocument();
      expect(request).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events/`,
        expect.objectContaining({
          query: expect.objectContaining({query: 'id:123', per_page: 1}),
        })
      );
    }
  );

  it('renders an http domain status link', async () => {
    const span: TestSpan = {
      id: '123',
      'span.op': 'http',
      'span.description': 'GET /users',
      'span.group': 'span_group',
      'span.category': 'http',
      'project.id': 1,
    };
    render(<DetailsWidgetVisualization span={span} />);

    const httpSpan = await screen.findByRole('link', {name: 'Status'});
    expect(httpSpan).toBeInTheDocument();
    expect(httpSpan).toHaveAttribute('href', 'https://status.sentry.io/');
    expect(httpSpan).toHaveTextContent('Status');

    expect(screen.getByText('sentry.io')).toBeInTheDocument();
  });
});
