import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';

function renderEmbed(name: string, data: Record<string, unknown>) {
  const raw = `{% ${name} %}${JSON.stringify(data)}{% /${name} %}`;
  return render(<SeerMarkdown raw={raw} />);
}

function hrefFor(name: string, label: string, data: Record<string, unknown>) {
  renderEmbed(name, data);
  return screen.getByRole('link', {name: label}).getAttribute('href') ?? '';
}

describe('Seer resource embeds', () => {
  let initialConfig: Config;

  beforeEach(() => {
    initialConfig = ConfigStore.getState();
  });

  afterEach(() => {
    ConfigStore.loadInitialData(initialConfig);
  });

  it('links a dashboard title to the dashboard in the current organization', async () => {
    const {router} = renderEmbed('dashboard', {
      id: '123',
      title: 'Application health',
    });

    await userEvent.click(screen.getByRole('link', {name: 'Application health'}));

    expect(router.location.pathname).toBe('/organizations/org-slug/dashboard/123/');
  });

  it('uses a dashboard fallback label and normalizes customer-domain links', () => {
    ConfigStore.set('customerDomain', {
      subdomain: 'org-slug',
      organizationUrl: 'https://org-slug.sentry.io',
      sentryUrl: 'https://sentry.io',
    });

    renderEmbed('dashboard', {id: '456'});

    expect(screen.getByRole('link', {name: 'Dashboard 456'})).toHaveAttribute(
      'href',
      '/dashboard/456/'
    );
  });

  it('links a replay to the relevant event timestamp', async () => {
    const {router} = renderEmbed('replay', {
      id: '4c1f2e3d1234567890',
      eventTimestamp: '2026-08-25T16:37:12Z',
    });

    await userEvent.click(screen.getByRole('link', {name: 'Replay 4c1f2e3d'}));

    expect(router.location.pathname).toBe(
      '/organizations/org-slug/explore/replays/4c1f2e3d1234567890/'
    );
    expect(router.location.query.event_t).toBe('2026-08-25T16:37:12Z');
  });

  it('links a replay without a timestamp to the beginning', () => {
    renderEmbed('replay', {id: 'abcdef1234567890'});

    expect(screen.getByRole('link', {name: 'Replay abcdef12'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/replays/abcdef1234567890/'
    );
  });

  describe('alert', () => {
    it('points a metric alert at its detector', () => {
      expect(
        hrefFor('alert', 'Checkout latency', {
          id: '4521',
          kind: 'metric',
          name: 'Checkout latency',
        })
      ).toBe('/organizations/org-slug/monitors/4521/');
    });

    it('points an issue alert at its automation', () => {
      expect(hrefFor('alert', 'Alert 881', {id: '881', kind: 'issue'})).toBe(
        '/organizations/org-slug/monitors/alerts/881/'
      );
    });

    it('falls back to an id-based label when the API name is missing', () => {
      renderEmbed('alert', {id: '4521', kind: 'metric'});
      expect(screen.getByRole('link', {name: 'Alert 4521'})).toBeInTheDocument();
    });
  });

  it('links a monitor to its detector detail page', () => {
    expect(hrefFor('monitor', 'nightly-sync', {id: '9931', name: 'nightly-sync'})).toBe(
      '/organizations/org-slug/monitors/9931/'
    );
  });

  it('links a saved issue view to the view route', () => {
    expect(hrefFor('savedIssueView', 'Unresolved', {id: '77', name: 'Unresolved'})).toBe(
      '/organizations/org-slug/issues/views/77/'
    );
  });

  it.each([
    ['spans', '/organizations/org-slug/explore/traces/?id=312'],
    ['logs', '/organizations/org-slug/explore/logs/?id=312'],
    ['metrics', '/organizations/org-slug/explore/metrics/?id=312'],
    ['replays', '/organizations/org-slug/explore/replays/?id=312'],
  ])('opens a saved %s query on its own explore surface', (dataset, expected) => {
    expect(hrefFor('savedQuery', 'Saved query 312', {id: '312', dataset})).toBe(expected);
  });

  describe('trace', () => {
    const traceId = 'a1b2c3d4e5f678901234567890abcdef';

    it('converts the ISO timestamp to unix seconds for the waterfall', () => {
      const href = hrefFor('trace', 'Trace a1b2c3d4', {
        traceId,
        timestamp: '2026-08-25T16:37:12Z',
      });

      expect(href).toContain(`/explore/traces/trace/${traceId}/`);
      expect(href).toContain(`timestamp=${Date.parse('2026-08-25T16:37:12Z') / 1000}`);
    });

    it('focuses a span when one is given', () => {
      expect(hrefFor('trace', 'Trace a1b2c3d4', {traceId, spanId: 'abc123'})).toContain(
        'node=span-abc123'
      );
    });

    it('omits trace query params that were not provided', () => {
      expect(hrefFor('trace', 'Trace a1b2c3d4', {traceId})).toBe(
        `/organizations/org-slug/explore/traces/trace/${traceId}/`
      );
    });
  });

  it('links a profile to its flamegraph', () => {
    expect(
      hrefFor('profile', 'Profile 7f3c2b1a', {
        projectSlug: 'javascript',
        profileId: '7f3c2b1a9d8e4f60',
      })
    ).toBe(
      '/organizations/org-slug/explore/profiles/profile/javascript/7f3c2b1a9d8e4f60/flamegraph/'
    );
  });

  describe('issuesQuery', () => {
    it('carries the search string and page filters into the issue stream', () => {
      const href = hrefFor('issuesQuery', 'Unresolved errors', {
        query: 'is:unresolved level:error',
        statsPeriod: '7d',
        projects: ['1', '2'],
        title: 'Unresolved errors',
      });

      expect(href).toContain('/organizations/org-slug/issues/');
      expect(href).toContain('query=is%3Aunresolved%20level%3Aerror');
      expect(href).toContain('statsPeriod=7d');
      expect(href).toContain('project=1');
      expect(href).toContain('project=2');
    });

    it('uses a generic label when Seer supplies no title', () => {
      renderEmbed('issuesQuery', {query: 'is:unresolved'});
      expect(screen.getByRole('link', {name: 'Issue search'})).toBeInTheDocument();
    });
  });

  it('builds an errors query with columns and a sort', () => {
    const href = hrefFor('errorsQuery', 'Checkout errors', {
      query: 'event.type:error',
      fields: ['title', 'count()'],
      sort: '-count',
      statsPeriod: '24h',
      title: 'Checkout errors',
    });

    expect(href).toContain('/explore/discover/results/');
    expect(href).toContain('query=event.type%3Aerror');
    expect(href).toContain('field=title');
    expect(href).toContain('field=count%28%29');
    expect(href).toContain('sort=-count');
  });

  describe('spansQuery', () => {
    it('builds a samples-mode query', () => {
      const href = hrefFor('spansQuery', 'Span search', {
        query: 'span.op:http.client',
        mode: 'samples',
        sort: '-span.duration',
        statsPeriod: '24h',
      });

      expect(href).toContain('/organizations/org-slug/explore/traces/');
      expect(href).toContain('mode=samples');
      expect(href).toContain('query=span.op%3Ahttp.client');
      expect(href).toContain('sort=-span.duration');
    });

    it('encodes group-bys and aggregates for aggregate mode', () => {
      const href = hrefFor('spansQuery', 'p95 by op', {
        mode: 'aggregate',
        groupBy: ['span.op'],
        yAxes: ['p95(span.duration)'],
        title: 'p95 by op',
      });

      expect(href).toContain('mode=aggregate');

      const params = new URL(href, 'https://sentry.io').searchParams;
      expect(params.getAll('aggregateField').map(field => JSON.parse(field))).toEqual([
        {groupBy: 'span.op'},
        {yAxes: ['p95(span.duration)']},
      ]);
    });
  });

  it('builds a logs query using the logs-prefixed params', () => {
    const href = hrefFor('logsQuery', 'Error logs', {
      query: 'severity:error',
      mode: 'samples',
      statsPeriod: '24h',
      title: 'Error logs',
    });

    expect(href).toContain('/organizations/org-slug/explore/logs/');
    expect(href).toContain('logsQuery=severity%3Aerror');
    expect(href).toContain('mode=samples');
  });

  it('builds a replays query', () => {
    const href = hrefFor('replaysQuery', 'Replay search', {
      query: 'count_rage_clicks:>0',
      statsPeriod: '7d',
    });

    expect(href).toContain('/organizations/org-slug/explore/replays/');
    expect(href).toContain('query=count_rage_clicks%3A%3E0');
    expect(href).toContain('statsPeriod=7d');
  });

  describe('metricsQuery', () => {
    it('encodes the metric as a single JSON param', () => {
      const href = hrefFor('metricsQuery', 'checkout.latency', {
        name: 'checkout.latency',
        type: 'distribution',
        unit: 'millisecond',
        mode: 'aggregate',
        yAxes: ['p95(value)'],
      });

      expect(href).toContain('/organizations/org-slug/explore/metrics/');

      const metric = new URL(href, 'https://sentry.io').searchParams.get('metric');
      expect(JSON.parse(metric ?? '{}')).toEqual({
        metric: {name: 'checkout.latency', type: 'distribution', unit: 'millisecond'},
        query: '',
        aggregateFields: [{yAxes: ['p95(value)']}],
        mode: 'aggregate',
      });
    });

    it('charts a default aggregate so the query stays decodable', () => {
      const href = hrefFor('metricsQuery', 'checkout.latency', {
        name: 'checkout.latency',
        type: 'distribution',
      });

      const metric = new URL(href, 'https://sentry.io').searchParams.get('metric');
      expect(JSON.parse(metric ?? '{}').aggregateFields).toEqual([
        {yAxes: ['sum(value)']},
      ]);
    });
  });
});
