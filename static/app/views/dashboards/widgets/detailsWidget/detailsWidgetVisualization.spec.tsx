// write some tests for the DetailsWidgetVisualization component

import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {DetailsWidgetVisualization} from 'sentry/views/dashboards/widgets/detailsWidget/detailsWidgetVisualization';

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
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders a span', () => {
    const span = {
      id: '123',
      ['span.op']: 'span_op',
      ['span.description']: 'span_description',
      ['span.group']: 'span_group',
      ['span.category']: 'span_category',
    };
    render(<DetailsWidgetVisualization span={span} />);
    expect(
      screen.getByText(`${span['span.op']} - ${span['span.description']}`)
    ).toBeInTheDocument();
  });

  it('renders a db span', async () => {
    const span = {
      id: '123',
      ['span.op']: 'db',
      ['span.description']: 'SELECT * FROM users',
      ['span.group']: 'span_group',
      ['span.category']: 'db',
    };
    render(<DetailsWidgetVisualization span={span} />);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    const queryCodeSnippet = await screen.findByText(/select \* from users/i);
    expect(queryCodeSnippet).toBeInTheDocument();
    expect(queryCodeSnippet).toHaveClass('language-sql');
  });
});
