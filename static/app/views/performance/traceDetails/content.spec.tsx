import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen, within} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {DEFAULT_EVENT_VIEW} from 'sentry/views/discover/data';
import TraceDetailsContent from 'sentry/views/performance/traceDetails/content';

const SAMPLE_ERROR_DATA = {
  data: [
    {id: '1', level: 'error', title: 'Test error 1', project: 'sentry'},
    {id: '2', level: 'fatal', title: 'Test error 2', project: 'sentry'},
  ],
};

const initializeData = () => {
  const data = _initializeData({
    features: ['performance-view', 'trace-view'],
  });

  act(() => ProjectsStore.loadInitialData(data.projects));
  return data;
};

describe('TraceDetailsContent', () => {
  describe('Without Transactions', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
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
      const meta = {
        errors: 2,
        projects: 1,
        transactions: 0,
        performance_issues: 1,
        transactiontoSpanChildrenCount: {},
      };

      render(
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

      const errorList = await screen.findByTestId('trace-view-errors');
      expect(
        await within(errorList).findByText(SAMPLE_ERROR_DATA.data[0]!.title)
      ).toBeInTheDocument();
      expect(
        await within(errorList).findByText(SAMPLE_ERROR_DATA.data[1]!.title)
      ).toBeInTheDocument();

      expect(
        await within(errorList).findByText(SAMPLE_ERROR_DATA.data[0]!.level)
      ).toBeInTheDocument();
      expect(
        await within(errorList).findByText(SAMPLE_ERROR_DATA.data[1]!.level)
      ).toBeInTheDocument();
    });

    it('should should display an error if the error events could not be fetched', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        statusCode: 404,
        body: {detail: 'This is a test error'},
      });

      const initialData = initializeData();
      const eventView = EventView.fromSavedQuery(DEFAULT_EVENT_VIEW);
      const meta = {
        errors: 2,
        projects: 1,
        transactions: 0,
        performance_issues: 0,
        transactiontoSpanChildrenCount: {},
      };

      render(
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

      const errorText = await screen.findByText(
        'The trace cannot be shown when all events are errors. An error occurred when attempting to fetch these error events: This is a test error'
      );

      const errorContainer = errorText.parentElement;
      expect(errorContainer).toBeInTheDocument();
    });
  });
});
