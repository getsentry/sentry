import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {OrganizationContext} from 'sentry/views/organizationContext';
import TransactionHeader from 'sentry/views/performance/transactionSummary/header';
import Tab from 'sentry/views/performance/transactionSummary/tabs';

type InitialOpts = {
  features?: string[];
  platform?: string;
};

function initializeData(opts?: InitialOpts) {
  const {features, platform} = opts ?? {};
  const project = TestStubs.Project({platform});
  const organization = TestStubs.Organization({
    projects: [project],
    features,
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
    project: project.id,
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

function ComponentProviders({
  organization,
  children,
}: {
  children: React.ReactNode;
  organization: Organization;
}) {
  return (
    <OrganizationContext.Provider value={organization}>
      {children}
    </OrganizationContext.Provider>
  );
}

describe('Performance > Transaction Summary Header', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('should render web vitals tab when yes', function () {
    const {project, organization, router, eventView} = initializeData();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    render(
      <ComponentProviders organization={organization}>
        <TransactionHeader
          eventView={eventView}
          location={router.location}
          organization={organization}
          projects={[project]}
          projectId={project.id}
          transactionName="transaction_name"
          currentTab={Tab.TransactionSummary}
          hasWebVitals="yes"
        />
      </ComponentProviders>
    );

    expect(screen.getByRole('tab', {name: 'Web Vitals'})).toBeInTheDocument();
  });

  it('should not render web vitals tab when no', function () {
    const {project, organization, router, eventView} = initializeData();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    <ComponentProviders organization={organization}>
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName="transaction_name"
        currentTab={Tab.TransactionSummary}
        hasWebVitals="no"
      />
    </ComponentProviders>;

    expect(screen.queryByRole('tab', {name: 'Web Vitals'})).not.toBeInTheDocument();
  });

  it('should render web vitals tab when maybe and is frontend platform', function () {
    const {project, organization, router, eventView} = initializeData({
      platform: 'javascript',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    render(
      <ComponentProviders organization={organization}>
        <TransactionHeader
          eventView={eventView}
          location={router.location}
          organization={organization}
          projects={[project]}
          projectId={project.id}
          transactionName="transaction_name"
          currentTab={Tab.TransactionSummary}
          hasWebVitals="maybe"
        />
      </ComponentProviders>
    );

    expect(screen.getByRole('tab', {name: 'Web Vitals'})).toBeInTheDocument();
  });

  it('should render web vitals tab when maybe and has measurements', async function () {
    const {project, organization, router, eventView} = initializeData();

    const eventHasMeasurementsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    render(
      <ComponentProviders organization={organization}>
        <TransactionHeader
          eventView={eventView}
          location={router.location}
          organization={organization}
          projects={[project]}
          projectId={project.id}
          transactionName="transaction_name"
          currentTab={Tab.TransactionSummary}
          hasWebVitals="maybe"
        />
      </ComponentProviders>
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

    render(
      <ComponentProviders organization={organization}>
        <TransactionHeader
          eventView={eventView}
          location={router.location}
          organization={organization}
          projects={[project]}
          projectId={project.id}
          transactionName="transaction_name"
          currentTab={Tab.TransactionSummary}
          hasWebVitals="maybe"
        />
      </ComponentProviders>
    );

    await waitFor(() => expect(eventHasMeasurementsMock).toHaveBeenCalled());

    expect(screen.queryByRole('tab', {name: 'Web Vitals'})).not.toBeInTheDocument();
  });

  it('should render spans tab with feature', function () {
    const {project, organization, router, eventView} = initializeData({
      features: ['performance-suspect-spans-view'],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    render(
      <ComponentProviders organization={organization}>
        <TransactionHeader
          eventView={eventView}
          location={router.location}
          organization={organization}
          projects={[project]}
          projectId={project.id}
          transactionName="transaction_name"
          currentTab={Tab.TransactionSummary}
          hasWebVitals="yes"
        />
      </ComponentProviders>
    );

    expect(screen.getByRole('tab', {name: 'Spans'})).toBeInTheDocument();
  });
});
