import {initializeOrg} from 'sentry-test/initializeOrg';
import {generateSuspectSpansResponse} from 'sentry-test/performance/initializePerformanceData';
import {act, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'app/stores/projectsStore';
import EventView from 'app/utils/discover/eventView';
import SuspectSpans from 'app/views/performance/transactionSummary/transactionOverview/suspectSpans';

function initializeData({query} = {query: {}}) {
  const features = ['performance-view', 'performance-suspect-spans-view'];
  const organization = TestStubs.Organization({
    features,
    projects: [TestStubs.Project()],
  });
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
  });
  act(() => void ProjectsStore.loadInitialData(initialData.organization.projects));
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

    it('renders basic UI elements', async function () {
      const initialData = initializeData();
      mountWithTheme(
        <SuspectSpans
          organization={initialData.organization}
          location={initialData.router.location}
          eventView={initialData.eventView}
          projectId="1"
          transactionName="Test Transaction"
        />,
        {context: initialData.routerContext}
      );

      expect(await screen.findByText('Suspect Spans')).toBeInTheDocument();
      expect(await screen.findByText('View All Spans')).toBeInTheDocument();
      expect(await screen.findByText('Operation')).toBeInTheDocument();
      expect(await screen.findByText('Description')).toBeInTheDocument();
      expect(await screen.findByText('P75 Exclusive Time')).toBeInTheDocument();
      expect(await screen.findByText('Total Occurrences')).toBeInTheDocument();
      expect(await screen.findByText('Total Exclusive Time')).toBeInTheDocument();
      expect(await screen.findByText('Example Transaction')).toBeInTheDocument();
    });
  });
});
