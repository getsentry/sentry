import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

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
        handleIncompatibleQuery={() => {}}
      />
    </OrganizationContext.Provider>
  );
};

describe('Performance > Transaction Summary Header', function () {
  let wrapper;

  afterEach(function () {
    MockApiClient.clearMockResponses();
    wrapper.unmount();
  });

  it('should render web vitals tab when yes', async function () {
    wrapper = mountWithTheme(<WrappedComponent hasWebVitals="yes" />);

    await tick();
    wrapper.update();

    expect(wrapper.find('ListLink[data-test-id="web-vitals-tab"]').exists()).toBeTruthy();
  });

  it('should not render web vitals tab when no', async function () {
    wrapper = mountWithTheme(<WrappedComponent hasWebVitals="no" />);

    await tick();
    wrapper.update();

    expect(wrapper.find('ListLink[data-test-id="web-vitals-tab"]').exists()).toBeFalsy();
  });

  it('should render web vitals tab when maybe and is frontend platform', async function () {
    wrapper = mountWithTheme(
      <WrappedComponent hasWebVitals="maybe" platform="javascript" />
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ListLink[data-test-id="web-vitals-tab"]').exists()).toBeTruthy();
  });

  it('should render web vitals tab when maybe and has measurements', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    wrapper = mountWithTheme(<WrappedComponent hasWebVitals="maybe" />);

    await tick();
    wrapper.update();

    expect(wrapper.find('ListLink[data-test-id="web-vitals-tab"]').exists()).toBeTruthy();
  });

  it('should not render web vitals tab when maybe and has no measurements', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });

    wrapper = mountWithTheme(<WrappedComponent hasWebVitals="maybe" />);

    await tick();
    wrapper.update();

    expect(wrapper.find('ListLink[data-test-id="web-vitals-tab"]').exists()).toBeFalsy();
  });

  it('should render spans tab with feature', async function () {
    wrapper = mountWithTheme(
      <WrappedComponent
        hasWebVitals="yes"
        features={['performance-suspect-spans-view']}
      />
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ListLink[data-test-id="spans-tab"]').exists()).toBeTruthy();
  });
});
