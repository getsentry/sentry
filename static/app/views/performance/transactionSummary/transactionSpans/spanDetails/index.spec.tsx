import {browserHistory} from 'react-router';

import {
  generateSuspectSpansResponse,
  initializeData as _initializeData,
} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import SpanDetails from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';

function initializeData(settings) {
  const data = _initializeData(settings);
  act(() => void ProjectsStore.loadInitialData(data.organization.projects));
  return data;
}

describe('Performance > Transaction Spans > Span Summary', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count()': 1}]},
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    // need to typecast to any to be able to call mockReset
    (browserHistory.push as any).mockReset();
  });

  describe('Without Span Data', function () {
    beforeEach(function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans-performance/',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans/',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans-stats/',
        body: {
          'percentileArray(spans_exclusive_time, 0.50)': {
            data: [
              [0, [{count: 0}]],
              [10, [{count: 0}]],
            ],
            order: 2,
            start: 0,
            end: 10,
          },
          'percentileArray(spans_exclusive_time, 0.75)': {
            data: [
              [0, [{count: 0}]],
              [10, [{count: 0}]],
            ],
            order: 2,
            start: 0,
            end: 10,
          },
          'percentileArray(spans_exclusive_time, 0.95)': {
            data: [
              [0, [{count: 0}]],
              [10, [{count: 0}]],
            ],
            order: 2,
            start: 0,
            end: 10,
          },
          'percentileArray(spans_exclusive_time, 0.99)': {
            data: [
              [0, [{count: 0}]],
              [10, [{count: 0}]],
            ],
            order: 2,
            start: 0,
            end: 10,
          },
        },
      });
    });

    it('renders empty when missing project param', function () {
      const data = initializeData({query: {transaction: 'transaction'}});

      const {container} = render(
        <SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />,
        {organization: data.organization}
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('renders empty when missing transaction param', function () {
      const data = initializeData({query: {project: '1'}});

      const {container} = render(
        <SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />,
        {organization: data.organization}
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('renders no data when empty response', async function () {
      const data = initializeData({
        features: ['performance-view'],
        query: {project: '1', transaction: 'transaction'},
      });

      render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
        context: data.routerContext,
        organization: data.organization,
      });

      expect(
        await screen.findByText('No results found for your query')
      ).toBeInTheDocument();

      expect(await screen.findByText('Self Time Breakdown')).toBeInTheDocument();
    });
  });

  describe('With Bad Span Data', function () {
    it('filters examples missing spans', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans-performance/',
        body: generateSuspectSpansResponse(),
      });

      // just want to get one span in the response
      const badExamples = [generateSuspectSpansResponse({examplesOnly: true})[0]];
      for (const example of badExamples[0].examples) {
        // make sure that the spans array is empty
        example.spans = [];
      }

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans/',
        body: badExamples,
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans-stats/',
        body: {
          'percentileArray(spans_exclusive_time, 0.50)': {
            data: [
              [0, [{count: 0}]],
              [10, [{count: 0}]],
            ],
            order: 2,
            start: 0,
            end: 10,
          },
          'percentileArray(spans_exclusive_time, 0.75)': {
            data: [
              [0, [{count: 0}]],
              [10, [{count: 0}]],
            ],
            order: 2,
            start: 0,
            end: 10,
          },
          'percentileArray(spans_exclusive_time, 0.95)': {
            data: [
              [0, [{count: 0}]],
              [10, [{count: 0}]],
            ],
            order: 2,
            start: 0,
            end: 10,
          },
          'percentileArray(spans_exclusive_time, 0.99)': {
            data: [
              [0, [{count: 0}]],
              [10, [{count: 0}]],
            ],
            order: 2,
            start: 0,
            end: 10,
          },
        },
      });

      const data = initializeData({
        features: ['performance-view'],
        query: {project: '1', transaction: 'transaction'},
      });

      render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
        context: data.routerContext,
        organization: data.organization,
      });

      expect(await screen.findByText('Event ID')).toBeInTheDocument();
      expect(await screen.findByText('Timestamp')).toBeInTheDocument();
      expect(await screen.findByText('Span Duration')).toBeInTheDocument();
      expect(await screen.findByText('Count')).toBeInTheDocument();
      expect(await screen.findByText('Cumulative Duration')).toBeInTheDocument();
    });
  });

  describe('With Span Data', function () {
    beforeEach(function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans-performance/',
        body: generateSuspectSpansResponse(),
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans/',
        body: generateSuspectSpansResponse({examplesOnly: true}),
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans-stats/',
        body: {
          'percentileArray(spans_exclusive_time, 0.50)': {
            data: [
              [0, [{count: 0}]],
              [10, [{count: 0}]],
            ],
            order: 2,
            start: 0,
            end: 10,
          },
          'percentileArray(spans_exclusive_time, 0.75)': {
            data: [
              [0, [{count: 0}]],
              [10, [{count: 0}]],
            ],
            order: 2,
            start: 0,
            end: 10,
          },
          'percentileArray(spans_exclusive_time, 0.95)': {
            data: [
              [0, [{count: 0}]],
              [10, [{count: 0}]],
            ],
            order: 2,
            start: 0,
            end: 10,
          },
          'percentileArray(spans_exclusive_time, 0.99)': {
            data: [
              [0, [{count: 0}]],
              [10, [{count: 0}]],
            ],
            order: 2,
            start: 0,
            end: 10,
          },
        },
      });
    });

    it('renders header elements', async function () {
      const data = initializeData({
        features: ['performance-view'],
        query: {project: '1', transaction: 'transaction'},
      });

      render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
        context: data.routerContext,
        organization: data.organization,
      });

      expect(await screen.findByText('Span Summary')).toBeInTheDocument();

      const operationNameHeader = await screen.findByTestId('header-operation-name');
      expect(
        await within(operationNameHeader).findByText('Span Operation')
      ).toBeInTheDocument();
      // TODO: add an expect for the span description here
      expect(
        await within(operationNameHeader).findByTestId('operation-name')
      ).toHaveTextContent('op');

      const percentilesHeader = await screen.findByTestId('header-percentiles');
      expect(
        await within(percentilesHeader).findByText('Self Time Percentiles')
      ).toBeInTheDocument();
      const p50Section = await within(percentilesHeader).findByTestId('section-p50');
      expect(await within(p50Section).findByText('1.00ms')).toBeInTheDocument();
      expect(await within(p50Section).findByText('p50')).toBeInTheDocument();
      const p75Section = await within(percentilesHeader).findByTestId('section-p75');
      expect(await within(p75Section).findByText('2.00ms')).toBeInTheDocument();
      expect(await within(p75Section).findByText('p75')).toBeInTheDocument();
      const p95Section = await within(percentilesHeader).findByTestId('section-p95');
      expect(await within(p95Section).findByText('3.00ms')).toBeInTheDocument();
      expect(await within(p95Section).findByText('p95')).toBeInTheDocument();
      const p99Section = await within(percentilesHeader).findByTestId('section-p99');
      expect(await within(p99Section).findByText('4.00ms')).toBeInTheDocument();
      expect(await within(p99Section).findByText('p99')).toBeInTheDocument();

      const frequencyHeader = await screen.findByTestId('header-frequency');
      expect(await within(frequencyHeader).findByText('100%')).toBeInTheDocument();
      expect(
        await within(frequencyHeader).findByText((_content, element) =>
          Boolean(
            element &&
              element.tagName === 'DIV' &&
              element.textContent === '1.00 times per event'
          )
        )
      ).toBeInTheDocument();

      const totalExclusiveTimeHeader = await screen.findByTestId(
        'header-total-exclusive-time'
      );
      expect(
        await within(totalExclusiveTimeHeader).findByText('5.00ms')
      ).toBeInTheDocument();
      expect(
        await within(totalExclusiveTimeHeader).findByText((_content, element) =>
          Boolean(
            element && element.tagName === 'DIV' && element.textContent === '1 events'
          )
        )
      ).toBeInTheDocument();
    });

    it('renders timeseries chart', async function () {
      const data = initializeData({
        features: ['performance-view'],
        query: {project: '1', transaction: 'transaction'},
      });

      render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
        context: data.routerContext,
        organization: data.organization,
      });

      expect(await screen.findByText('Self Time Breakdown')).toBeInTheDocument();
    });

    it('renders table headers', async function () {
      const data = initializeData({
        features: ['performance-view'],
        query: {project: '1', transaction: 'transaction'},
      });

      render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
        context: data.routerContext,
        organization: data.organization,
      });

      expect(await screen.findByText('Event ID')).toBeInTheDocument();
      expect(await screen.findByText('Timestamp')).toBeInTheDocument();
      expect(await screen.findByText('Span Duration')).toBeInTheDocument();
      expect(await screen.findByText('Count')).toBeInTheDocument();
      expect(await screen.findByText('Cumulative Duration')).toBeInTheDocument();
    });

    describe('With histogram view feature flag enabled', function () {
      const FEATURES = ['performance-view', 'performance-span-histogram-view'];

      beforeEach(function () {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/recent-searches/',
          method: 'GET',
          body: [],
        });
      });

      it('renders a search bar', function () {
        const data = initializeData({
          features: FEATURES,
          query: {project: '1', transaction: 'transaction'},
        });

        render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
          context: data.routerContext,
          organization: data.organization,
        });

        const searchBarNode = screen.getByPlaceholderText('Filter Transactions');
        expect(searchBarNode).toBeInTheDocument();
      });

      it('disables reset button when no min or max query parameters were set', function () {
        const data = initializeData({
          features: FEATURES,
          query: {project: '1', transaction: 'transaction'},
        });

        render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
          context: data.routerContext,
          organization: data.organization,
        });

        const resetButton = screen.getByRole('button', {
          name: /reset view/i,
        });
        expect(resetButton).toBeInTheDocument();
        expect(resetButton).toBeDisabled();
      });

      it('enables reset button when min and max are set', function () {
        const data = initializeData({
          features: FEATURES,
          query: {project: '1', transaction: 'transaction', min: '10', max: '100'},
        });

        render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
          context: data.routerContext,
          organization: data.organization,
        });

        const resetButton = screen.getByRole('button', {
          name: /reset view/i,
        });
        expect(resetButton).toBeEnabled();
      });

      it('clears min and max query parameters when reset button is clicked', function () {
        const data = initializeData({
          features: FEATURES,
          query: {project: '1', transaction: 'transaction', min: '10', max: '100'},
        });

        render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
          context: data.routerContext,
          organization: data.organization,
        });

        const resetButton = screen.getByRole('button', {
          name: /reset view/i,
        });
        resetButton.click();
        expect(browserHistory.push).toHaveBeenCalledWith(
          expect.not.objectContaining({min: expect.any(String), max: expect.any(String)})
        );
      });

      it('does not add aggregate filters to the query', async function () {
        const data = initializeData({
          features: FEATURES,
          query: {project: '1', transaction: 'transaction'},
        });

        render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
          context: data.routerContext,
          organization: data.organization,
        });

        const searchBarNode = await screen.findByPlaceholderText('Filter Transactions');
        await userEvent.click(searchBarNode);
        await userEvent.paste('count():>3');
        expect(searchBarNode).toHaveTextContent('count():>3');
        expect(browserHistory.push).not.toHaveBeenCalled();
      });

      it('renders a display toggle that changes a chart view between timeseries and histogram by pushing it to the browser history', async function () {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-spans-histogram/',
          body: [
            {bin: 0, count: 0},
            {bin: 10, count: 2},
            {bin: 20, count: 4},
          ],
        });

        const data = initializeData({
          features: FEATURES,
          query: {project: '1', transaction: 'transaction'},
        });

        render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
          context: data.routerContext,
          organization: data.organization,
        });

        expect(await screen.findByTestId('total-value')).toBeInTheDocument();

        const chartTitleNodes = await screen.findAllByText('Self Time Breakdown');
        expect(chartTitleNodes[0]).toBeInTheDocument();

        const displayToggle = await screen.findByTestId('display-toggle');
        expect(displayToggle).toBeInTheDocument();
        expect(await within(displayToggle).findByRole('button')).toHaveTextContent(
          'Self Time Breakdown'
        );

        (await within(displayToggle).findByRole('button')).click();
        (
          await within(displayToggle).findByRole('option', {
            name: 'Self Time Distribution',
          })
        ).click();

        expect(browserHistory.push).toHaveBeenCalledWith(
          expect.objectContaining({
            query: {
              display: 'histogram',
              project: '1',
              transaction: 'transaction',
            },
          })
        );
      });

      it('renders a histogram when display is set to histogram', async function () {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-spans-histogram/',
          body: [
            {bin: 0, count: 0},
            {bin: 10, count: 2},
            {bin: 20, count: 4},
          ],
        });

        const data = initializeData({
          features: FEATURES,
          query: {project: '1', transaction: 'transaction', display: 'histogram'},
        });

        render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
          context: data.routerContext,
          organization: data.organization,
        });

        const displayToggle = await screen.findByTestId('display-toggle');
        expect(await within(displayToggle).findByRole('button')).toHaveTextContent(
          'Self Time Distribution'
        );

        const nodes = await screen.findAllByText('Self Time Distribution');
        expect(nodes[0]).toBeInTheDocument();
      });

      it('gracefully handles error response', async function () {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-spans-histogram/',
          statusCode: 400,
        });

        const data = initializeData({
          features: FEATURES,
          query: {project: '1', transaction: 'transaction', display: 'histogram'},
        });

        render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
          context: data.routerContext,
          organization: data.organization,
        });

        expect(await screen.findByTestId('histogram-error-panel')).toBeInTheDocument();
      });

      it('gracefully renders empty histogram when empty buckets are received', async function () {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-spans-histogram/',
          body: [
            {bin: 0, count: 0},
            {bin: 10, count: 0},
            {bin: 20, count: 0},
          ],
        });

        const data = initializeData({
          features: FEATURES,
          query: {project: '1', transaction: 'transaction', display: 'histogram'},
        });

        render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
          context: data.routerContext,
          organization: data.organization,
        });

        const nodes = await screen.findAllByText('Self Time Distribution');
        expect(nodes[0]).toBeInTheDocument();
      });

      it('sends min and max to span example query', function () {
        const mock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-spans/',
          body: {},
        });
        const data = initializeData({
          features: FEATURES,
          query: {project: '1', transaction: 'transaction', min: '10', max: '120'},
        });

        render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
          context: data.routerContext,
          organization: data.organization,
        });

        expect(mock).toHaveBeenLastCalledWith(
          '/organizations/org-slug/events-spans/',
          expect.objectContaining({
            query: expect.objectContaining({
              min_exclusive_time: '10',
              max_exclusive_time: '120',
            }),
          })
        );
      });

      it('sends min and max to suspect spans query', function () {
        const mock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-spans-performance/',
          body: {},
        });
        const data = initializeData({
          features: FEATURES,
          query: {project: '1', transaction: 'transaction', min: '10', max: '120'},
        });

        render(<SpanDetails params={{spanSlug: 'op:aaaaaaaa'}} {...data} />, {
          context: data.routerContext,
          organization: data.organization,
        });

        expect(mock).toHaveBeenLastCalledWith(
          '/organizations/org-slug/events-spans-performance/',
          expect.objectContaining({
            query: expect.objectContaining({
              min_exclusive_time: '10',
              max_exclusive_time: '120',
            }),
          })
        );
      });
    });
  });
});

describe('spanDetailsRouteWithQuery', function () {
  it('should encode slashes in span op', function () {
    const target = spanDetailsRouteWithQuery({
      orgSlug: 'org-slug',
      transaction: 'transaction',
      query: {},
      spanSlug: {op: 'o/p', group: 'aaaaaaaaaaaaaaaa'},
      projectID: '1',
    });

    expect(target).toEqual(
      expect.objectContaining({
        pathname:
          '/organizations/org-slug/performance/summary/spans/o%2Fp:aaaaaaaaaaaaaaaa/',
      })
    );
  });
});
