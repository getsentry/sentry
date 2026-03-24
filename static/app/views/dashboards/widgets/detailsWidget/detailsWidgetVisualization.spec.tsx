// write some tests for the DetailsWidgetVisualization component

import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {DetailsWidgetVisualization} from 'sentry/views/dashboards/widgets/detailsWidget/detailsWidgetVisualization';
import type {DefaultDetailWidgetFields} from 'sentry/views/dashboards/widgets/detailsWidget/types';
import type {SpanResponse} from 'sentry/views/insights/types';

type TestSpan = Pick<SpanResponse, DefaultDetailWidgetFields>;

describe('DetailsWidgetVisualization', () => {
  beforeEach(() => {
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
      ['span.op']: 'span_op',
      ['span.description']: 'span_description',
      ['span.group']: 'span_group',
      ['span.category']: 'span_category',
      ['project.id']: 1,
    };
    render(<DetailsWidgetVisualization span={span} />);
    expect(
      screen.getByText(`${span['span.op']} - ${span['span.description']}`)
    ).toBeInTheDocument();
  });

  it('renders a db span', async () => {
    const span: TestSpan = {
      id: '123',
      ['span.op']: 'db',
      ['span.description']: 'SELECT * FROM users',
      ['span.group']: 'span_group',
      ['span.category']: 'db',
      ['project.id']: 1,
    };
    render(<DetailsWidgetVisualization span={span} />);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    const queryCodeSnippet = await screen.findByText(/select \* from users/i);
    expect(queryCodeSnippet).toBeInTheDocument();
    expect(queryCodeSnippet).toHaveClass('language-sql');
  });

  it('renders an http domain status link', async () => {
    const span: TestSpan = {
      id: '123',
      ['span.op']: 'http',
      ['span.description']: 'GET /users',
      ['span.group']: 'span_group',
      ['span.category']: 'http',
      ['project.id']: 1,
    };
    render(<DetailsWidgetVisualization span={span} />);

    const httpSpan = await screen.findByRole('link', {name: 'Status'});
    expect(httpSpan).toBeInTheDocument();
    expect(httpSpan).toHaveAttribute('href', 'https://status.sentry.io/');
    expect(httpSpan).toHaveTextContent('Status');

    expect(screen.getByText('sentry.io')).toBeInTheDocument();
  });
});
