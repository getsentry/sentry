import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';
import {act, mountWithTheme, screen, within} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {DEFAULT_EVENT_VIEW} from 'sentry/views/eventsV2/data';
import TraceDetailsContent from 'sentry/views/performance/traceDetails/content';

const SAMPLE_ERROR_DATA = {
  data: [
    {id: '1', title: 'Test error 1'},
    {id: '2', title: 'Test error 2'},
  ],
};

const initializeData = () => {
  const data = _initializeData({
    features: ['performance-view'],
  });

  act(() => ProjectsStore.loadInitialData(data.organization.projects));
  return data;
};

describe('TraceDetailsContent', () => {
  describe('Without Transactions', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/eventsv2/',
        body: SAMPLE_ERROR_DATA,
      });
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
      ProjectsStore.reset();
    });

    it('should render a list of errors when a trace contains only error events', async () => {
      const initialData = initializeData();
      const eventView = EventView.fromSavedQuery(DEFAULT_EVENT_VIEW);
      const meta = {errors: 2, projects: 1, transactions: 0};

      mountWithTheme(
        <TraceDetailsContent
          location={initialData.location}
          organization={initialData.organization}
          traceSlug="123"
          params={{traceSlug: '123'}}
          traceEventView={eventView}
          dateSelected
          isLoading={false}
          error={null}
          traces={null}
          meta={meta}
        />
      );

      const errorList = await screen.findByTestId('trace-view-errors-list');
      expect(
        await within(errorList).findByText(SAMPLE_ERROR_DATA.data[0].title)
      ).toBeInTheDocument();
      expect(
        await within(errorList).findByText(SAMPLE_ERROR_DATA.data[1].title)
      ).toBeInTheDocument();
    });
  });
});
