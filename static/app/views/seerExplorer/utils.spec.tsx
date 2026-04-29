import {decodeMetricsQueryParams} from 'sentry/views/explore/metrics/metricQuery';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {
  buildToolLinkUrl,
  getToolsStringFromBlock,
  postProcessLLMMarkdown,
} from 'sentry/views/seerExplorer/utils';

describe('postProcessLLMMarkdown', () => {
  describe('issue short ID linkification', () => {
    it('linkifies a simple short ID', () => {
      expect(postProcessLLMMarkdown('see PROJECT-1 please')).toBe(
        'see [PROJECT-1](/issues/PROJECT-1/) please'
      );
    });

    it('linkifies multi-hyphen short IDs without truncating trailing segments', () => {
      expect(postProcessLLMMarkdown('caused by FRONTEND-REACT-59A today')).toBe(
        'caused by [FRONTEND-REACT-59A](/issues/FRONTEND-REACT-59A/) today'
      );
      expect(postProcessLLMMarkdown('BACKEND-FLASK-F2 is flaky')).toBe(
        '[BACKEND-FLASK-F2](/issues/BACKEND-FLASK-F2/) is flaky'
      );
      expect(postProcessLLMMarkdown('see BACKEND-RUBY-ON-RAILS-58')).toBe(
        'see [BACKEND-RUBY-ON-RAILS-58](/issues/BACKEND-RUBY-ON-RAILS-58/)'
      );
    });

    it('linkifies multiple short IDs in one string', () => {
      expect(
        postProcessLLMMarkdown('FRONTEND-REACT-59A and BACKEND-FLASK-F2 are related')
      ).toBe(
        '[FRONTEND-REACT-59A](/issues/FRONTEND-REACT-59A/) and [BACKEND-FLASK-F2](/issues/BACKEND-FLASK-F2/) are related'
      );
    });

    it('does not linkify lowercase tokens', () => {
      expect(postProcessLLMMarkdown('lowercase-not-matched here')).toBe(
        'lowercase-not-matched here'
      );
    });

    it('does not linkify short IDs inside existing markdown links', () => {
      const input = 'see [FRONTEND-REACT-59A](https://example.com/foo) for details';
      expect(postProcessLLMMarkdown(input)).toBe(input);
    });

    it('does not linkify short IDs inside inline code', () => {
      const input = 'the id `FRONTEND-REACT-59A` is raw';
      expect(postProcessLLMMarkdown(input)).toBe(input);
    });

    it('does not linkify short IDs inside URLs', () => {
      const input = 'go to https://example.com/issues/FRONTEND-REACT-59A now';
      expect(postProcessLLMMarkdown(input)).toBe(input);
    });

    it('returns empty string for null / undefined / empty input', () => {
      expect(postProcessLLMMarkdown(null)).toBe('');
      expect(postProcessLLMMarkdown(undefined)).toBe('');
      expect(postProcessLLMMarkdown('')).toBe('');
    });
  });
});

describe('buildToolLinkUrl', () => {
  it('builds metrics links with encoded metric query state from Seer metadata', () => {
    const result = buildToolLinkUrl(
      {
        kind: 'telemetry_live_search',
        params: {
          dataset: 'tracemetrics',
          query: 'metric.name:"tool.duration" metric.type:distribution',
          trace_metric: {name: 'tool.duration', type: 'distribution', unit: 'second'},
          y_axes: ['p75(value)'],
          group_by: ['environment'],
          sort: '-p75(value)',
          mode: 'aggregates',
          stats_period: '7d',
        },
      },
      'org-slug'
    );

    expect(result).toEqual(
      expect.objectContaining({
        pathname: '/organizations/org-slug/explore/metrics/',
        query: expect.objectContaining({
          statsPeriod: '7d',
        }),
      })
    );

    const encodedMetric = (result as any)?.query?.metric?.[0];
    const decoded = decodeMetricsQueryParams(encodedMetric);

    expect(decoded?.metric).toEqual({
      name: 'tool.duration',
      type: 'distribution',
      unit: 'second',
    });
    expect(decoded?.queryParams.mode).toBe(Mode.AGGREGATE);
    expect(decoded?.queryParams.query).toBe(
      'metric.name:"tool.duration" metric.type:distribution'
    );
    expect(decoded?.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('p75(value,tool.duration,distribution,second)'),
      {groupBy: 'environment'},
    ]);
    expect(decoded?.queryParams.aggregateSortBys).toEqual([
      {field: 'p75(value,tool.duration,distribution,second)', kind: 'desc'},
    ]);
  });

  it('does not build a metrics link without Seer metric metadata', () => {
    const result = buildToolLinkUrl(
      {
        kind: 'telemetry_live_search',
        params: {
          dataset: 'tracemetrics',
          query:
            'metric.name:"tool.duration" metric.type:distribution metric.unit:second',
          y_axes: ['p75(value)'],
          mode: 'aggregates',
        },
      },
      'org-slug'
    );

    expect(result).toBeNull();
  });
});

describe('getToolsStringFromBlock', () => {
  it('shows defaulted metrics time range in tool text', () => {
    const tools = getToolsStringFromBlock({
      id: 'block',
      loading: false,
      timestamp: '',
      message: {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'tc-1',
            function: 'telemetry_live_search',
            args: JSON.stringify({
              dataset: 'tracemetrics',
              question: 'p95 of char count metric grouped by environment',
              project_slugs: [],
            }),
          },
        ],
      },
      tool_results: [
        {
          tool_call_id: 'tc-1',
          tool_call_function: 'telemetry_live_search',
          content: '',
        },
      ],
      tool_links: [
        {
          kind: 'telemetry_live_search',
          params: {
            dataset: 'tracemetrics',
            stats_period: '7d',
            time_range_defaulted: true,
          },
        },
      ],
    });

    expect(tools).toEqual([
      "Queried metrics in seer: 'p95 of char count metric grouped by environment in the last 7 days'",
    ]);
  });

  it('does not show defaulted metrics time range for explicit ranges', () => {
    const tools = getToolsStringFromBlock({
      id: 'block',
      loading: false,
      timestamp: '',
      message: {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'tc-1',
            function: 'telemetry_live_search',
            args: JSON.stringify({
              dataset: 'tracemetrics',
              question: 'p95 of char count metric grouped by environment',
              project_slugs: [],
            }),
          },
        ],
      },
      tool_results: [
        {
          tool_call_id: 'tc-1',
          tool_call_function: 'telemetry_live_search',
          content: '',
        },
      ],
      tool_links: [
        {
          kind: 'telemetry_live_search',
          params: {
            dataset: 'tracemetrics',
            stats_period: '7d',
            time_range_defaulted: false,
          },
        },
      ],
    });

    expect(tools).toEqual([
      "Queried metrics in seer: 'p95 of char count metric grouped by environment'",
    ]);
  });
});
