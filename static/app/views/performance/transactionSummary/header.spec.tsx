import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

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

describe('Performance > Transaction Summary Header', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
  });

  it('should render', async () => {
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
      />
    );

    expect(await screen.findByRole('tab', {name: 'Overview'})).toBeInTheDocument();
  });
});
