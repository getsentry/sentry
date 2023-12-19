import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import TransactionThresholdButton from 'sentry/views/performance/transactionSummary/transactionThresholdButton';

function renderComponent(eventView, organization, onChangeThreshold) {
  return render(
    <TransactionThresholdButton
      eventView={eventView}
      organization={organization}
      transactionName="transaction/threshold"
      onChangeThreshold={onChangeThreshold}
    />
  );
}

describe('TransactionThresholdButton', function () {
  const organization = Organization({features: ['performance-view']});
  const project = ProjectFixture();
  const eventView = new EventView({
    id: '1',
    name: 'my query',
    fields: [{field: 'count()'}],
    sorts: [{field: 'count', kind: 'desc'}],
    query: '',
    project: [parseInt(project.id, 10)],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: [],
    createdBy: undefined,
    display: '',
    team: ['myteams'],
    topEvents: undefined,
  });
  const onChangeThreshold = jest.fn();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
  });

  it('renders element correctly', async function () {
    const getTransactionThresholdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      body: {
        threshold: '800',
        metric: 'lcp',
      },
    });

    const getProjectThresholdMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/transaction-threshold/configure/',
      method: 'GET',
      body: {
        threshold: '200',
        metric: 'duration',
      },
    });
    renderComponent(eventView, organization, onChangeThreshold);

    const button = screen.getByRole('button');
    await waitFor(() => expect(button).toBeEnabled());
    expect(getTransactionThresholdMock).toHaveBeenCalledTimes(1);
    expect(getProjectThresholdMock).not.toHaveBeenCalled();
  });

  it('gets project threshold if transaction threshold does not exist', async function () {
    const getTransactionThresholdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      statusCode: 404,
    });

    const getProjectThresholdMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/transaction-threshold/configure/',
      method: 'GET',
      body: {
        threshold: '200',
        metric: 'duration',
      },
    });
    renderComponent(eventView, organization, onChangeThreshold);

    const button = screen.getByRole('button');
    await waitFor(() => expect(button).toBeEnabled());

    expect(getTransactionThresholdMock).toHaveBeenCalledTimes(1);
    expect(getProjectThresholdMock).toHaveBeenCalledTimes(1);
  });

  it('mounts modal with the right values', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      body: {
        threshold: '800',
        metric: 'lcp',
      },
    });

    renderComponent(eventView, organization, onChangeThreshold);

    const button = screen.getByRole('button');
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    renderGlobalModal();

    expect(screen.getByRole('spinbutton')).toHaveValue(800);
    expect(screen.getByText('Largest Contentful Paint')).toBeInTheDocument();
  });
});
