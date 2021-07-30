import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import EventView from 'app/utils/discover/eventView';
import TransactionHeader, {Tab} from 'app/views/performance/transactionSummary/header';

function initializeData(opts?: {platform?: string}) {
  // @ts-expect-error
  const project = TestStubs.Project({platform: opts?.platform});
  // @ts-expect-error
  const organization = TestStubs.Organization({
    projects: [project],
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
    // @ts-expect-error
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
        transactionName="transaction_name"
        currentTab={Tab.TransactionSummary}
        hasWebVitals="yes"
        handleIncompatibleQuery={() => {}}
      />
    );

    // @ts-expect-error
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
        transactionName="transaction_name"
        currentTab={Tab.TransactionSummary}
        hasWebVitals="no"
        handleIncompatibleQuery={() => {}}
      />
    );

    // @ts-expect-error
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
        transactionName="transaction_name"
        currentTab={Tab.TransactionSummary}
        hasWebVitals="maybe"
        handleIncompatibleQuery={() => {}}
      />
    );

    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('ListLink[data-test-id="web-vitals-tab"]').exists()).toBeTruthy();
  });

  it('should render web vitals tab when maybe and has measurements', async function () {
    // @ts-expect-error
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
        transactionName="transaction_name"
        currentTab={Tab.TransactionSummary}
        hasWebVitals="maybe"
        handleIncompatibleQuery={() => {}}
      />
    );

    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('ListLink[data-test-id="web-vitals-tab"]').exists()).toBeTruthy();
  });

  it('should not render web vitals tab when maybe and has no measurements', async function () {
    // @ts-expect-error
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
        transactionName="transaction_name"
        currentTab={Tab.TransactionSummary}
        hasWebVitals="maybe"
        handleIncompatibleQuery={() => {}}
      />
    );

    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('ListLink[data-test-id="web-vitals-tab"]').exists()).toBeFalsy();
  });
});
