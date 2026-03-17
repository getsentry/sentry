import {
  createTraceMetricFixtures,
  initializeTraceMetricsTest,
} from 'sentry-fixture/tracemetrics';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';

const SORTED_METRIC_NAMES = [
  'bar',
  'error_rate',
  'foo',
  'memory_usage',
  'request_count',
  'response_size',
];

const DEFAULT_TRACE_METRIC = {name: 'bar', type: 'distribution'};

describe('MetricSelector', () => {
  const {organization, project, setupPageFilters, setupEventsMock} =
    initializeTraceMetricsTest();

  beforeEach(() => {
    // Suppress react-popper async flushSync/act warnings (known library compat issue)
    jest.spyOn(console, 'error').mockImplementation();

    setupPageFilters();
    const {baseFixtures} = createTraceMetricFixtures(organization, project, new Date());

    setupEventsMock(baseFixtures, [
      MockApiClient.matchQuery({
        dataset: 'tracemetrics',
        referrer: 'api.explore.metric-options',
      }),
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    MockApiClient.clearMockResponses();
  });

  describe('dropdown functionality', () => {
    it('renders trigger button showing metric name', () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });
      expect(screen.getByRole('button', {name: 'bar'})).toBeInTheDocument();
    });

    it('renders trigger button with None when traceMetric has no name', () => {
      render(<MetricSelector traceMetric={{name: '', type: ''}} onChange={jest.fn()} />, {
        organization,
      });
      expect(screen.getByRole('button', {name: 'None'})).toBeInTheDocument();
    });

    describe('loading state', () => {
      beforeEach(() => {
        // Replace mock with one that never resolves to keep loading state
        MockApiClient.clearMockResponses();
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/events/`,
          method: 'GET',
          body: new Promise(() => {}),
          match: [
            MockApiClient.matchQuery({
              dataset: 'tracemetrics',
              referrer: 'api.explore.metric-options',
            }),
          ],
        });
      });

      it('disables trigger button while loading when no metric is selected', () => {
        render(
          <MetricSelector traceMetric={{name: '', type: ''}} onChange={jest.fn()} />,
          {organization}
        );
        expect(screen.getByRole('button', {name: 'None'})).toBeDisabled();
      });

      it('does not disable trigger button while loading when a metric is already selected', () => {
        render(
          <MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />,
          {organization}
        );
        expect(screen.getByRole('button', {name: 'bar'})).toBeEnabled();
      });
    });

    it('opens dropdown on click', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });
      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      expect(await screen.findByRole('listbox')).toBeInTheDocument();
    });

    it('opens dropdown when trigger receives ArrowDown', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });
      const trigger = screen.getByRole('button', {name: 'bar'});
      trigger.focus();

      await userEvent.keyboard('{ArrowDown}');

      expect(await screen.findByRole('listbox')).toBeInTheDocument();
    });

    it('closes on Escape', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });
      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      await screen.findByRole('listbox');
      await userEvent.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('closes after selecting an option and calls onChange', async () => {
      const onChange = jest.fn();
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={onChange} />, {
        organization,
      });
      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      await userEvent.click(await screen.findByRole('option', {name: 'foo'}));
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({name: 'foo'}));
    });

    describe('empty state', () => {
      beforeEach(() => {
        setupEventsMock(
          [],
          [
            MockApiClient.matchQuery({
              dataset: 'tracemetrics',
              referrer: 'api.explore.metric-options',
            }),
          ]
        );
      });

      afterEach(() => {
        MockApiClient.clearMockResponses();
      });

      it('shows empty state when API returns no metrics', async () => {
        render(
          <MetricSelector traceMetric={{name: '', type: ''}} onChange={jest.fn()} />,
          {organization}
        );

        await userEvent.click(screen.getByRole('button', {name: 'None'}));

        expect(await screen.findByText('No metrics found')).toBeInTheDocument();
      });
    });

    it('focuses search input when dropdown opens', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      const searchInput = await screen.findByPlaceholderText('Search metrics\u2026');

      expect(searchInput).toHaveFocus();
    });

    it('shows search input in open dropdown', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));

      expect(
        await screen.findByPlaceholderText('Search metrics\u2026')
      ).toBeInTheDocument();
    });

    it('search input accepts typed text', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      const searchInput = await screen.findByPlaceholderText('Search metrics\u2026');
      await userEvent.type(searchInput, 'foo');

      expect(searchInput).toHaveValue('foo');
    });

    it('clears search on close and reopens with empty search', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });

      const trigger = screen.getByRole('button', {name: 'bar'});
      await userEvent.click(trigger);

      const searchInput = await screen.findByPlaceholderText('Search metrics\u2026');
      await userEvent.type(searchInput, 'foo');

      expect(searchInput).toHaveValue('foo');

      await userEvent.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });

      await userEvent.click(trigger);
      expect(await screen.findByPlaceholderText('Search metrics\u2026')).toHaveValue('');
    });

    it('ArrowDown followed by Enter selects an option', async () => {
      const onChange = jest.fn();
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={onChange} />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      await screen.findByRole('option', {name: 'bar'});
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{Enter}');

      expect(onChange).toHaveBeenCalled();
    });

    it('ArrowDown from search moves focus to first option', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });
      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      await userEvent.keyboard('{ArrowDown}');

      expect(
        await screen.findByRole('option', {name: SORTED_METRIC_NAMES[0]!})
      ).toHaveFocus();
    });

    it('ArrowDown twice selects second option with Enter', async () => {
      const onChange = jest.fn();
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={onChange} />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      await screen.findByRole('option', {name: SORTED_METRIC_NAMES[0]!});
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{Enter}');

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({name: SORTED_METRIC_NAMES[1]})
      );
    });

    it('keeps keyboard selection valid when displayed options shrink', async () => {
      const onChange = jest.fn();
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={onChange} />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      await screen.findByRole('option', {name: SORTED_METRIC_NAMES[0]!});

      // Move focus near the end of the list
      for (let i = 0; i < 5; i++) {
        await userEvent.keyboard('{ArrowDown}');
      }

      // Simulate search that narrows the list by re-mocking with fewer results
      MockApiClient.clearMockResponses();
      setupEventsMock(
        createTraceMetricFixtures(organization, project, new Date()).baseFixtures.slice(
          0,
          2
        ),
        [
          MockApiClient.matchQuery({
            dataset: 'tracemetrics',
            referrer: 'api.explore.metric-options',
          }),
        ]
      );

      const searchInput = screen.getByPlaceholderText('Search metrics\u2026');
      await userEvent.type(searchInput, 'b');

      // After list shrinks, keyboard selection should still pick a valid option.
      await waitFor(() => {
        expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(2);
      });
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{Enter}');
      expect(onChange).toHaveBeenCalled();
    });

    it('ArrowUp does not go below index 0', async () => {
      const onChange = jest.fn();
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={onChange} />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      await screen.findByRole('option', {name: SORTED_METRIC_NAMES[0]!});
      await userEvent.keyboard('{ArrowUp}');
      await userEvent.keyboard('{Enter}');

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({name: SORTED_METRIC_NAMES[0]})
      );
    });
  });

  describe('metric-specific behavior', () => {
    it('renders list of metrics from API', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      for (const name of SORTED_METRIC_NAMES) {
        expect(await screen.findByRole('option', {name})).toBeInTheDocument();
      }
    });

    it('shows MetricTypeBadge for each option', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      await screen.findByRole('listbox');

      expect((await screen.findAllByText('distribution')).length).toBeGreaterThan(0);
      expect(await screen.findByText('gauge')).toBeInTheDocument();
    });

    it('shows currently selected metric as aria-selected="true"', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));

      expect(await screen.findByRole('option', {name: 'bar'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('shows unselected metrics as aria-selected="false"', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));

      expect(await screen.findByRole('option', {name: 'foo'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
    });

    it('auto-selects first metric when traceMetric has no name', async () => {
      const onChange = jest.fn();

      render(<MetricSelector traceMetric={{name: '', type: ''}} onChange={onChange} />, {
        organization,
      });

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({name: SORTED_METRIC_NAMES[0]})
        );
      });
    });

    it('does not show unit badges without tracemetrics-units-ui feature', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      await screen.findByRole('option', {name: 'bar'});

      expect(screen.queryByText('millisecond')).not.toBeInTheDocument();
      expect(screen.queryByText('megabyte')).not.toBeInTheDocument();
    });

    it('shows unit badges when tracemetrics-units-ui feature is enabled', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization: {
          ...organization,
          features: [...organization.features, 'tracemetrics-units-ui'],
        },
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      await screen.findByRole('listbox');

      expect((await screen.findAllByText('millisecond')).length).toBeGreaterThan(0);
    });

    it('does not show a unit badge when the metric unit is none', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization: {
          ...organization,
          features: [...organization.features, 'tracemetrics-units-ui'],
        },
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));

      const requestCountOption = await screen.findByRole('option', {
        name: 'request_count',
      });

      expect(within(requestCountOption).queryByText('none')).not.toBeInTheDocument();
    });

    it('does not show side panel without tracemetrics-attributes-dropdown-side-panel feature', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      await screen.findByRole('option', {name: 'bar'});

      expect(screen.queryByText('Type:')).not.toBeInTheDocument();
    });

    it('renders side panel with tracemetrics-attributes-dropdown-side-panel feature', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization: {
          ...organization,
          features: [
            ...organization.features,
            'tracemetrics-attributes-dropdown-side-panel',
          ],
        },
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));

      expect(await screen.findByText('Type:')).toBeInTheDocument();
    });

    it('side panel defaults to current metric when no option is hovered', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization: {
          ...organization,
          features: [
            ...organization.features,
            'tracemetrics-attributes-dropdown-side-panel',
          ],
        },
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      await screen.findByRole('listbox');

      expect(await screen.findByText('Type:')).toBeInTheDocument();
      expect((await screen.findAllByText('bar')).length).toBeGreaterThan(0);
    });

    it('side panel updates when hovering over a different metric option', async () => {
      render(<MetricSelector traceMetric={DEFAULT_TRACE_METRIC} onChange={jest.fn()} />, {
        organization: {
          ...organization,
          features: [
            ...organization.features,
            'tracemetrics-attributes-dropdown-side-panel',
          ],
        },
      });

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      await userEvent.hover(await screen.findByRole('option', {name: 'foo'}));

      await waitFor(() => {
        expect(screen.getAllByText('foo').length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
