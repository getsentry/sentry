import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import EventView from 'app/utils/discover/eventView';
import TransactionHeader from 'app/views/performance/transactionSummary/header';
import Tab from 'app/views/performance/transactionSummary/tabs';

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

describe('Performance > Transaction Summary Header', function () {
  let wrapper;

  afterEach(function () {
    MockApiClient.clearMockResponses();
    wrapper.unmount();
  });

  it('should render web vitals tab when yes', async function () {
    const {project, organization, router, eventView} = initializeData();

    wrapper = mountWithTheme(
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName="transaction_name"
        currentTab={Tab.TransactionSummary}
        hasWebVitals="yes"
        handleIncompatibleQuery={() => {}}
      />
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ListLink[data-test-id="web-vitals-tab"]').exists()).toBeTruthy();
  });

  it('should not render web vitals tab when no', async function () {
    const {project, organization, router, eventView} = initializeData();

    wrapper = mountWithTheme(
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName="transaction_name"
        currentTab={Tab.TransactionSummary}
        hasWebVitals="no"
        handleIncompatibleQuery={() => {}}
      />
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ListLink[data-test-id="web-vitals-tab"]').exists()).toBeFalsy();
  });

  it('should render web vitals tab when maybe and is frontend platform', async function () {
    const {project, organization, router, eventView} = initializeData({
      platform: 'javascript',
    });

    wrapper = mountWithTheme(
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName="transaction_name"
        currentTab={Tab.TransactionSummary}
        hasWebVitals="maybe"
        handleIncompatibleQuery={() => {}}
      />
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

    const {project, organization, router, eventView} = initializeData();

    wrapper = mountWithTheme(
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName="transaction_name"
        currentTab={Tab.TransactionSummary}
        hasWebVitals="maybe"
        handleIncompatibleQuery={() => {}}
      />
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ListLink[data-test-id="web-vitals-tab"]').exists()).toBeTruthy();
  });

  it('should not render web vitals tab when maybe and has no measurements', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });

    const {project, organization, router, eventView} = initializeData();

    wrapper = mountWithTheme(
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName="transaction_name"
        currentTab={Tab.TransactionSummary}
        hasWebVitals="maybe"
        handleIncompatibleQuery={() => {}}
      />
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ListLink[data-test-id="web-vitals-tab"]').exists()).toBeFalsy();
  });

  it('should render spans tab with feature', async function () {
    const {project, organization, router, eventView} = initializeData({
      features: ['performance-suspect-spans-view'],
    });

    wrapper = mountWithTheme(
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName="transaction_name"
        currentTab={Tab.TransactionSummary}
        hasWebVitals="yes"
        handleIncompatibleQuery={() => {}}
      />
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ListLink[data-test-id="spans-tab"]').exists()).toBeTruthy();
  });
});
