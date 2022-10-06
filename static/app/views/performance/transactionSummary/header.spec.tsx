import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

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

const WrappedComponent = ({
  hasWebVitals,
  platform,
  features,
}: {
  hasWebVitals: 'yes' | 'no' | 'maybe';
} & InitialOpts) => {
  const {project, organization, router, eventView} = initializeData({features, platform});

  return (
    <OrganizationContext.Provider value={organization}>
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName="transaction_name"
        currentTab={Tab.TransactionSummary}
        hasWebVitals={hasWebVitals}
      />
    </OrganizationContext.Provider>
  );
};

describe('Performance > Transaction Summary Header', function () {
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('should render web vitals tab when yes', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    render(<WrappedComponent hasWebVitals="yes" />);
    expect(screen.getByRole('tab', {name: 'Web Vitals'})).toBeInTheDocument();
  });

  it('should not render web vitals tab when no', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    render(<WrappedComponent hasWebVitals="no" />);
    expect(screen.queryByRole('tab', {name: 'Web Vitals'})).not.toBeInTheDocument();
  });

  it('should render web vitals tab when maybe and is frontend platform', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    render(<WrappedComponent hasWebVitals="maybe" platform="javascript" />);
    expect(screen.getByRole('tab', {name: 'Web Vitals'})).toBeInTheDocument();
  });

  it('should render web vitals tab when maybe and has measurements', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    render(<WrappedComponent hasWebVitals="maybe" />);
    expect(await screen.findByRole('tab', {name: 'Web Vitals'})).toBeInTheDocument();
  });

  it('should not render web vitals tab when maybe and has no measurements', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });

    render(<WrappedComponent hasWebVitals="maybe" />);
    expect(screen.queryByRole('tab', {name: 'Web Vitals'})).not.toBeInTheDocument();
  });

  it('should render spans tab with feature', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });

    render(
      <WrappedComponent
        hasWebVitals="yes"
        features={['performance-suspect-spans-view']}
      />
    );
    expect(screen.getByRole('tab', {name: 'Spans'})).toBeInTheDocument();
  });
});
