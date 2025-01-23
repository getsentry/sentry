import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {generateSuspectSpansResponse} from 'sentry-test/performance/initializePerformanceData';
import {
  act,
  render,
  screen,
  // waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {OrganizationContext} from 'sentry/views/organizationContext';
import SuspectSpans from 'sentry/views/performance/transactionSummary/transactionOverview/suspectSpans';

function initializeData({query} = {query: {}}) {
  const features = ['performance-view'];
  const organization = OrganizationFixture({features});
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          transaction: 'Test Transaction',
          project: '1',
          ...query,
        },
      },
    },
    projects: [],
  });

  act(() => void ProjectsStore.loadInitialData(initialData.projects));
  return {
    ...initialData,
    eventView: EventView.fromLocation(initialData.router.location),
  };
}

describe('SuspectSpans', function () {
  describe('With Span Data', function () {
    beforeEach(function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans-performance/',
        body: generateSuspectSpansResponse({
          examples: 1,
        }),
      });
    });

    afterEach(function () {
      jest.resetAllMocks();
    });

    it('renders basic UI elements', async function () {
      const initialData = initializeData();
      render(
        <OrganizationContext.Provider value={initialData.organization}>
          <MEPSettingProvider>
            <SuspectSpans
              organization={initialData.organization}
              location={initialData.router.location}
              eventView={initialData.eventView}
              projectId="1"
              transactionName="Test Transaction"
              totals={{'count()': 1}}
            />
          </MEPSettingProvider>
        </OrganizationContext.Provider>
      );

      expect(await screen.findByText('Suspect Spans')).toBeInTheDocument();
      expect(await screen.findByText('View All Spans')).toBeInTheDocument();
      expect(await screen.findByText('Span Operation')).toBeInTheDocument();
      expect(await screen.findByText('Span Name')).toBeInTheDocument();
      expect(await screen.findByText('Frequency')).toBeInTheDocument();
      expect(await screen.findByText('P75 Self Time')).toBeInTheDocument();
      expect(await screen.findByText('Total Self Time')).toBeInTheDocument();
    });
  });
});
