import {OrganizationFixture} from 'sentry-fixture/organization';
import {TelemetryClassifierFixture} from 'sentry-fixture/telemetryClassifier';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ClassifierDetail from './detail';

describe('ClassifierDetail', () => {
  const organization = OrganizationFixture({features: ['classifiers-ui']});
  const detailUrl = `/organizations/${organization.slug}/classifiers/10/`;

  function renderDetail() {
    return render(<ClassifierDetail />, {
      organization,
      initialRouterConfig: {
        location: {pathname: `/organizations/${organization.slug}/seer/classifiers/10/`},
        route: '/organizations/:orgId/seer/classifiers/:classifierId/',
      },
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders the classifier name and dataset', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({
        id: '10',
        name: 'Stuck in a loop',
        dataset: 'conversation',
      }),
    });

    renderDetail();

    expect(
      await screen.findByRole('heading', {name: 'Stuck in a loop', level: 2})
    ).toBeInTheDocument();
    expect(screen.getByText('Dataset:')).toBeInTheDocument();
    expect(screen.getAllByText('Conversations')).toHaveLength(2);
    expect(screen.getByText('Users impacted')).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon')).toHaveLength(2);
  });

  it('shows a not found message when the classifier does not exist', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      statusCode: 404,
      body: {detail: 'Not found'},
    });

    renderDetail();

    expect(
      await screen.findByText('The classifier could not be found.')
    ).toBeInTheDocument();
  });
});
