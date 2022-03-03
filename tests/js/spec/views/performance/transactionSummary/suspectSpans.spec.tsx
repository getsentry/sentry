import {initializeOrg} from 'sentry-test/initializeOrg';
import {generateSuspectSpansResponse} from 'sentry-test/performance/initializePerformanceData';
import {
  act,
  mountWithTheme,
  screen,
  // waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import SuspectSpans from 'sentry/views/performance/transactionSummary/transactionOverview/suspectSpans';

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
          totals={{count: 1}}
        />
      );

      expect(await screen.findByText('Suspect Spans')).toBeInTheDocument();
      expect(await screen.findByText('View All Spans')).toBeInTheDocument();
      expect(await screen.findByText('Span Operation')).toBeInTheDocument();
      expect(await screen.findByText('Span Name')).toBeInTheDocument();
      expect(await screen.findByText('Total Count')).toBeInTheDocument();
      expect(await screen.findByText('Frequency')).toBeInTheDocument();
      expect(await screen.findByText('P75 Self Time')).toBeInTheDocument();
      expect(await screen.findByText('Total Self Time')).toBeInTheDocument();
    });

    // Due to the createHref being stubbed out (see link below),
    // the anchors all have an empty href so we can't actually
    // test this.
    //
    // https://github.com/getsentry/sentry/blob/28a2337ae902785d4d3e914c0ba484fa883cc17a/tests/js/setup.ts#L162
    //
    // it('allows sorting by some columns', async function () {
    //   const initialData = initializeData();
    //   mountWithTheme(
    //     <SuspectSpans
    //       organization={initialData.organization}
    //       location={initialData.router.location}
    //       eventView={initialData.eventView}
    //       projectId="1"
    //       transactionName="Test Transaction"
    //     />,
    //   );

    //   await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));
    //   expect(screen.getByText('P75 Self Time')).toHaveAttribute('href', null);
    //   expect(screen.getByText('Total Occurrences')).toHaveAttribute('href', null);
    //   expect(screen.getByText('Total Self Time')).toHaveAttribute('href', null);
    // });
  });
});
