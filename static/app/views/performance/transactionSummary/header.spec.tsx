import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import type {PlatformKey} from 'sentry/types/project';
import EventView from 'sentry/utils/discover/eventView';
import TransactionHeader from 'sentry/views/performance/transactionSummary/header';
import Tab from 'sentry/views/performance/transactionSummary/tabs';

type InitialOpts = {
  features?: string[];
  platform?: PlatformKey;
};

function initializeData(opts?: InitialOpts) {
  const {features, platform} = opts ?? {};
  const project = ProjectFixture({platform});
  const organization = OrganizationFixture({
    features: features ?? [],
  });

  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          project: project.id,
        },
      },
    },
    projects: [],
  });
  const router = initialData.router;
  const eventView = EventView.fromSavedQuery({
    id: undefined,
    version: 2,
    name: '',
    fields: ['transaction.status'], // unused fields
    projects: [parseInt(project.id, 10)],
  });
  return {
    project,
    organization,
    router,
    eventView,
  };
}

describe('Performance > Transaction Summary Header', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
  });

  it('should render web vitals tab when yes', async function () {
    const {project, organization, router, eventView} = initializeData();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    render(
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName="transaction_name"
        currentTab={Tab.TRANSACTION_SUMMARY}
        hasWebVitals="yes"
      />
    );

    expect(await screen.findByRole('tab', {name: 'Web Vitals'})).toBeInTheDocument();
  });

  it('should not render web vitals tab when hasWebVitals=no', async function () {
    const {project, organization, router, eventView} = initializeData();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    render(
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName="transaction_name"
        currentTab={Tab.TRANSACTION_SUMMARY}
        hasWebVitals="no"
      />
    );

    await act(tick);

    expect(screen.queryByRole('tab', {name: 'Web Vitals'})).not.toBeInTheDocument();
  });

  it('should render web vitals tab when maybe and is frontend platform', async function () {
    const {project, organization, router, eventView} = initializeData({
      platform: 'javascript',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    render(
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName="transaction_name"
        currentTab={Tab.TRANSACTION_SUMMARY}
        hasWebVitals="maybe"
      />
    );

    expect(await screen.findByRole('tab', {name: 'Web Vitals'})).toBeInTheDocument();
  });

  it('should render web vitals tab when maybe and has measurements', async function () {
    const {project, organization, router, eventView} = initializeData();

    const eventHasMeasurementsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    render(
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName="transaction_name"
        currentTab={Tab.TRANSACTION_SUMMARY}
        hasWebVitals="maybe"
      />
    );

    await waitFor(() => expect(eventHasMeasurementsMock).toHaveBeenCalled());

    expect(screen.getByRole('tab', {name: 'Web Vitals'})).toBeInTheDocument();
  });

  it('should not render web vitals tab when maybe and has no measurements', async function () {
    const {project, organization, router, eventView} = initializeData();

    const eventHasMeasurementsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });

    render(
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName="transaction_name"
        currentTab={Tab.TRANSACTION_SUMMARY}
        hasWebVitals="maybe"
      />
    );

    await waitFor(() => expect(eventHasMeasurementsMock).toHaveBeenCalled());

    expect(screen.queryByRole('tab', {name: 'Web Vitals'})).not.toBeInTheDocument();
  });

  it('should render spans tab with feature', async function () {
    const {project, organization, router, eventView} = initializeData({});

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    render(
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName="transaction_name"
        currentTab={Tab.TRANSACTION_SUMMARY}
        hasWebVitals="yes"
      />
    );

    expect(await screen.findByRole('tab', {name: 'Spans'})).toBeInTheDocument();
  });
});
