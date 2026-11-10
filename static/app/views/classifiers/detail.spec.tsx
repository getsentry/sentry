import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TelemetryClassifierFixture} from 'sentry-fixture/telemetryClassifier';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';

import ClassifierDetail from './detail';

const DISABLED_MESSAGE =
  'This classifier is disabled and is not classifying new conversations.';

describe('ClassifierDetail', () => {
  const organization = OrganizationFixture({features: ['classifiers-ui']});
  const detailUrl = `/organizations/${organization.slug}/classifiers/10/`;

  function renderDetail(org: Organization = organization) {
    return render(<ClassifierDetail />, {
      organization: org,
      initialRouterConfig: {
        location: {pathname: `/organizations/${org.slug}/seer/classifiers/10/`},
        route: '/organizations/:orgId/seer/classifiers/:classifierId/',
      },
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'frontend'})]);
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

  it('disables the classifier after confirming', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({id: '10', projectId: '1', status: 'enabled'}),
    });
    const updateRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'PUT',
      body: TelemetryClassifierFixture({id: '10', projectId: '1', status: 'disabled'}),
    });

    renderDetail();
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Disable'}));
    const modal = await screen.findByRole('dialog');
    expect(
      within(modal).getByText(
        'Are you sure you want to disable this classifier? New conversations will no longer be classified.'
      )
    ).toBeInTheDocument();
    expect(updateRequest).not.toHaveBeenCalled();

    await userEvent.click(within(modal).getByRole('button', {name: 'Disable'}));

    expect(updateRequest).toHaveBeenCalledWith(
      detailUrl,
      expect.objectContaining({data: {status: 'disabled'}})
    );
    expect(await screen.findByText(DISABLED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Enable'})).toBeInTheDocument();
  });

  it('enables a disabled classifier', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({id: '10', projectId: '1', status: 'disabled'}),
    });
    const updateRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'PUT',
      body: TelemetryClassifierFixture({id: '10', projectId: '1', status: 'enabled'}),
    });

    renderDetail();

    expect(await screen.findByText(DISABLED_MESSAGE)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Enable'}));

    expect(updateRequest).toHaveBeenCalledWith(
      detailUrl,
      expect.objectContaining({data: {status: 'enabled'}})
    );
    expect(await screen.findByRole('button', {name: 'Disable'})).toBeInTheDocument();
    expect(screen.queryByText(DISABLED_MESSAGE)).not.toBeInTheDocument();
  });

  it('disables the status toggle without project write access', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({id: '10', projectId: '1', status: 'enabled'}),
    });

    renderDetail(
      OrganizationFixture({features: ['classifiers-ui'], access: ['org:read']})
    );

    expect(await screen.findByRole('button', {name: 'Disable'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
