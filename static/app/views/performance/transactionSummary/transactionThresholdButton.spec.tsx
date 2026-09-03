import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
import {TransactionThresholdButton} from 'sentry/views/performance/transactionSummary/transactionThresholdButton';

function renderComponent(
  eventView: EventView,
  organization: Organization,
  onChangeThreshold: () => void
) {
  return render(
    <TransactionThresholdButton
      eventView={eventView}
      organization={organization}
      transactionName="transaction/threshold"
      onChangeThreshold={onChangeThreshold}
    />
  );
}

describe('TransactionThresholdButton', () => {
  const organization = OrganizationFixture({features: ['performance-view']});
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

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
  });

  it('renders element correctly', async () => {
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

  it('gets project threshold if transaction threshold does not exist', async () => {
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

  it('mounts modal with the right values', async () => {
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

  it('stays disabled until the project has loaded', async () => {
    const getTransactionThresholdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      body: {threshold: '800', metric: 'lcp'},
    });
    // Projects are fetched in parallel with the organization, so the page can
    // render before the store is populated.
    ProjectsStore.reset();

    renderComponent(eventView, organization, onChangeThreshold);

    const button = screen.getByRole('button', {name: 'Settings'});
    expect(button).toBeDisabled();
    expect(getTransactionThresholdMock).not.toHaveBeenCalled();

    act(() => ProjectsStore.loadInitialData([project]));

    await waitFor(() => expect(button).toBeEnabled());
    expect(getTransactionThresholdMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the project default after the override is reset', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      body: {threshold: '800', metric: 'lcp'},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'DELETE',
    });
    const getProjectThresholdMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/transaction-threshold/configure/',
      method: 'GET',
      body: {threshold: '200', metric: 'duration'},
    });

    renderComponent(eventView, organization, onChangeThreshold);
    renderGlobalModal();

    const button = screen.getByRole('button', {name: 'Settings'});
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    expect(await screen.findByRole('spinbutton')).toHaveValue(800);

    // Once the override is deleted the endpoint 404s, the same as for a
    // transaction that never had one.
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      statusCode: 404,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Reset All'}));

    // The modal reads the project default itself before closing; the second
    // call is the refetch triggered by the now-404 override.
    await waitFor(() => expect(getProjectThresholdMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    expect(await screen.findByRole('spinbutton')).toHaveValue(200);
  });
});
