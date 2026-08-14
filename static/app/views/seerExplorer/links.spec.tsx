import {OrganizationFixture} from 'sentry-fixture/organization';

import {decodeMetricsQueryParams} from 'sentry/views/explore/metrics/metricQuery';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {
  LINK_RULES,
  type LinkSubject,
  resolveLink,
  subjectFromCallRecord,
  subjectFromToolLink,
} from 'sentry/views/seerExplorer/links';
import type {CallRecord} from 'sentry/views/seerExplorer/types';

const organization = OrganizationFixture({slug: 'org-slug'});
const projects = [
  {id: '2', slug: 'javascript'},
  {id: '3', slug: 'python'},
];
const ctx = {organization, projects};

/**
 * One call per rule that reaches it and resolves.
 *
 * Lives here rather than in `links.tsx` so the app bundle carries only the strings it renders. The
 * tests below turn this map into the two guards a table read top-to-bottom needs: that every rule is
 * reachable, and that none is shadowed by a more generic rule above it.
 *
 * A rule added without an entry fails `coverage`, by name.
 */
const LINK_RULE_EXAMPLES: Record<string, LinkSubject> = {
  get_event_details: {
    kind: 'api',
    method: 'GET',
    path: '/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/events/{event_id}/',
    params: {issue_id: '54', event_id: 'deadbeef'},
  },
  get_issue_details: {
    kind: 'api',
    method: 'GET',
    path: '/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/',
    params: {issue_id: '54'},
  },
  get_trace_waterfall: {
    kind: 'api',
    method: 'GET',
    path: '/api/0/organizations/{organization_id_or_slug}/trace/{trace_id}/',
    params: {trace_id: 'trace1'},
  },
  get_span_details: {
    kind: 'lib',
    name: 'get_span_details',
    params: {trace_id: 'trace1', span_id: 'span1'},
  },
  get_replay_details: {
    kind: 'api',
    method: 'GET',
    path: '/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/replays/{replay_id}/',
    params: {replay_id: 'replay1'},
  },
  get_project_details: {
    kind: 'api',
    method: 'GET',
    path: '/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/',
    params: {organization_id_or_slug: 'org-slug', project_id_or_slug: 'javascript'},
  },
  get_profile_flamegraph: {
    kind: 'link',
    name: 'get_profile_flamegraph',
    params: {profile_id: 'profile1', project_id: '2'},
  },
  get_log_attributes: {
    kind: 'link',
    name: 'get_log_attributes',
    params: {trace_id: 'trace1'},
  },
  get_metric_attributes: {
    kind: 'link',
    name: 'get_metric_attributes',
    params: {trace_id: 'trace1'},
  },
  telemetry_live_search: {
    kind: 'link',
    name: 'telemetry_live_search',
    params: {dataset: 'issues', query: 'is:unresolved'},
  },
};

function matches(rule: (typeof LINK_RULES)[number], subject: LinkSubject) {
  return subject.name === rule.id || rule.match?.(subject) === true;
}

describe('LINK_RULES', () => {
  it('has an example for every rule, and no example for a rule that does not exist', () => {
    expect(Object.keys(LINK_RULE_EXAMPLES).sort()).toEqual(
      LINK_RULES.map(rule => rule.id).sort()
    );
  });

  it('has unique ids, since clicks are reported by id', () => {
    const ids = LINK_RULES.map(rule => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The table is read top to bottom, so a rule placed under a more generic one that also matches its
  // example is dead code. This is the guard that makes ordering a checkable property rather than
  // something a reviewer has to hold in their head.
  it.each(LINK_RULES.map(rule => [rule.id] as const))(
    '%s is reachable, and resolves its example',
    id => {
      const index = LINK_RULES.findIndex(rule => rule.id === id);
      const subject = LINK_RULE_EXAMPLES[id]!;
      const shadowedBy = LINK_RULES.slice(0, index).filter(
        earlier => matches(earlier, subject) && earlier.resolve(subject, ctx)
      );

      expect(shadowedBy.map(rule => rule.id)).toEqual([]);
      expect(resolveLink(subject, ctx)?.id).toBe(id);
    }
  );

  // Producing a link is the only reason to be in this table. Renaming a row is seer's job, and a row
  // with no rule already falls back to the title it ships — so a rule that resolves to a label alone
  // is a worse copy of something that works, and one that resolves to a url alone would render an
  // anchor with no text, since a link seer emits directly carries no title. The type says both; this
  // says neither is blank.
  it.each(LINK_RULES.map(rule => [rule.id] as const))(
    '%s resolves to a labeled link, the only reason to be in the table',
    id => {
      const result = LINK_RULES.find(rule => rule.id === id)!.resolve(
        LINK_RULE_EXAMPLES[id]!,
        ctx
      );

      expect(result?.label).toBeTruthy();
      expect(result?.url).toBeTruthy();
    }
  );
});

describe('resolveLink', () => {
  it('keeps looking when a rule matches the route but declines', () => {
    // `/issues/{issue_id}/events/{event_id}/` matches the event rule, which needs both ids and has
    // neither here — so the issue rule does not get a chance either, and nothing claims the row.
    const declined = resolveLink(
      {
        kind: 'api',
        method: 'GET',
        path: '/api/0/organizations/{organization_id_or_slug}/eventids/{event_id}/',
        params: {event_id: 'deadbeef'},
      },
      ctx
    );
    expect(declined).toBeNull();

    // The same route with an alias for the event id: the event rule delegates to the issue rule
    // rather than building a page that 404s, and reports itself as the rule that fired.
    const delegated = resolveLink(
      {
        kind: 'api',
        method: 'GET',
        path: '/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/events/{event_id}/',
        params: {issue_id: '54', event_id: 'latest'},
      },
      ctx
    );
    expect(delegated).toEqual({
      id: 'get_event_details',
      label: 'View issue',
      url: {pathname: '/organizations/org-slug/issues/54/', query: {}},
    });
  });

  // The issue rule matches this route and would happily build `/issues/54/`, which is guaranteed to
  // 404 by the time anyone clicks it. The row still renders — `Remove an Issue` is seer's title, and
  // `callRecordLabel` supplies it — it just is not a link.
  it('claims nothing on a DELETE, however well the route matches', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'DELETE',
          path: '/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/',
          params: {issue_id: '54'},
          title: 'Remove an Issue',
        },
        ctx
      )
    ).toBeNull();
  });

  // A literal segment where an entity rule expects a param: this route ends at `latest/`, so it names
  // no event, and it does not end at `{issue_id}` either. Both entity regexes miss and the row is a
  // row about fetching, not about a thing you can open.
  it('claims nothing for a route whose last segment is a literal, not a param', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'GET',
          path: '/api/0/issues/{issue_id}/events/latest/',
          params: {issue_id: '54'},
          title: 'Retrieve the Latest Event',
        },
        ctx
      )
    ).toBeNull();
  });

  it('does not double-prefix a path that is already org-scoped', () => {
    const url = resolveLink(
      {
        kind: 'api',
        method: 'GET',
        path: '/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/',
        params: {issue_id: '54'},
      },
      ctx
    )?.url;

    expect(JSON.stringify(url)).not.toContain('/organizations/org-slug/organizations/');
  });

  // A `CallRecord`'s path params are always strings, but seer emits link params straight from its own
  // payload, where an id is a number. Both name the same issue, so both have to link.
  it('links an id that arrives as a number, not a string', () => {
    expect(
      resolveLink(
        subjectFromToolLink({kind: 'get_issue_details', params: {issue_id: 54}}),
        ctx
      )
    ).toEqual({
      id: 'get_issue_details',
      label: 'View issue',
      url: {pathname: '/organizations/org-slug/issues/54/', query: {}},
    });
  });

  it('claims nothing for a route no rule knows', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'GET',
          path: '/api/0/organizations/{organization_id_or_slug}/releases/',
          params: {organization_id_or_slug: 'org-slug'},
          title: 'List an Organization’s Releases',
        },
        ctx
      )
    ).toBeNull();
  });
});

describe('project links', () => {
  function record(pathParams: Record<string, string>): CallRecord {
    return {
      id: 1,
      kind: 'api',
      method: 'GET',
      path: '/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/',
      path_params: {organization_id_or_slug: 'org-slug', ...pathParams},
      title: 'Retrieve a Project',
    };
  }

  // The `insights/projects` segment is `makeProjectsPathname`'s doing — it moves to `projects` with
  // the `insights-to-dashboards-ui-rollout` flag, which the fixture org does not have. The rule calls
  // the helper rather than writing the path, so the destination follows that rollout for free.
  it('links a slug straight through, without needing the project loaded', () => {
    expect(
      resolveLink(subjectFromCallRecord(record({project_id_or_slug: 'python'})), ctx)
    ).toEqual({
      id: 'get_project_details',
      label: 'Retrieve a Project',
      url: {pathname: '/organizations/org-slug/insights/projects/python/'},
    });
  });

  it('resolves a numeric id to its slug, since project pages route on slug', () => {
    expect(
      resolveLink(subjectFromCallRecord(record({project_id_or_slug: '2'})), ctx)
    ).toEqual({
      id: 'get_project_details',
      label: 'Retrieve a Project',
      url: {
        pathname: '/organizations/org-slug/insights/projects/javascript/',
        query: {project: '2'},
      },
    });
  });

  it('leaves the row unlinked when the id is not a project the viewer can see', () => {
    const link = resolveLink(
      subjectFromCallRecord(record({project_id_or_slug: '999'})),
      ctx
    );
    expect(link).toBeNull();
  });

  it('does not link a project it just deleted', () => {
    const subject = subjectFromCallRecord({
      ...record({project_id_or_slug: 'python'}),
      method: 'DELETE',
      title: 'Delete a Project',
    });
    expect(resolveLink(subject, ctx)).toBeNull();
  });

  // The other half of the routes ending at `{project_id_or_slug}`: a row about a weekly-report
  // exclusion is not a row about a project, and the method guard is what keeps it from linking.
  it('does not link a weekly-report exclusion to the project page', () => {
    const subject: LinkSubject = {
      kind: 'api',
      method: 'DELETE',
      path: '/api/0/organizations/{organization_id_or_slug}/weekly-report-project-exclusions/{project_id_or_slug}/',
      params: {organization_id_or_slug: 'org-slug', project_id_or_slug: 'python'},
      title: 'Remove a Weekly Report Exclusion',
    };
    expect(resolveLink(subject, ctx)).toBeNull();
  });
});

describe('search links', () => {
  it('encodes metric query state from the metadata seer sent', () => {
    const result = resolveLink(
      subjectFromToolLink({
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
      }),
      ctx
    )?.url;

    expect(result).toEqual(
      expect.objectContaining({
        pathname: '/organizations/org-slug/explore/metrics/',
        query: expect.objectContaining({statsPeriod: '7d'}),
      })
    );

    const decoded = decodeMetricsQueryParams((result as any)?.query?.metric?.[0]);

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

  it('does not build a metrics link without the metric to chart', () => {
    expect(
      resolveLink(
        subjectFromToolLink({
          kind: 'telemetry_live_search',
          params: {
            dataset: 'tracemetrics',
            query: 'metric.name:"tool.duration"',
            y_axes: ['p75(value)'],
            mode: 'aggregates',
          },
        }),
        ctx
      )
    ).toBeNull();
  });

  // Same name on both channels, and only the link carries the query. The row records that a search
  // ran and carries nothing to re-run it with, so the rule declines rather than manufacturing a
  // destination out of the name alone.
  it('does not link a search row, only the link seer emitted alongside it', () => {
    const subject = subjectFromCallRecord({
      id: 1,
      kind: 'lib',
      name: 'telemetry_live_search',
      params: {dataset: 'spans', question: 'top pageloads'},
    });
    expect(resolveLink(subject, ctx)).toBeNull();
  });

  it('builds one Explore link with every project_slug selected', () => {
    const result = resolveLink(
      subjectFromToolLink({
        kind: 'telemetry_live_search',
        params: {
          dataset: 'spans',
          query: 'transaction.op:pageload',
          project_slugs: ['javascript', 'python'],
          stats_period: '24h',
        },
      }),
      ctx
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'telemetry_live_search',
        label: 'View spans',
        url: expect.objectContaining({
          pathname: '/organizations/org-slug/traces/',
          query: expect.objectContaining({
            query: 'transaction.op:pageload',
            project: ['2', '3'],
            statsPeriod: '24h',
          }),
        }),
      })
    );
  });

  it('links a span lib call into the trace waterfall node', () => {
    const result = resolveLink(
      subjectFromCallRecord({
        id: 1,
        kind: 'lib',
        name: 'get_span_details',
        params: {trace_id: 'trace1', span_id: 'span1'},
        title: 'Retrieving span span1 in trace trace1',
      }),
      ctx
    );

    expect(result).toEqual({
      id: 'get_span_details',
      label: 'Retrieving span span1 in trace trace1',
      url: {
        pathname: '/organizations/org-slug/explore/traces/trace/trace1/',
        query: {node: 'span-span1'},
      },
    });
  });
});

describe('subjectFromCallRecord', () => {
  it('splits the query off resolved_path, so a rule can read a param the route does not name', () => {
    expect(
      subjectFromCallRecord({
        id: 1,
        kind: 'api',
        method: 'GET',
        path: '/api/0/organizations/{organization_id_or_slug}/events/',
        resolved_path: '/api/0/organizations/org-slug/events/?dataset=logs&per_page=10',
      })
    ).toEqual(
      expect.objectContaining({
        pathname: '/api/0/organizations/org-slug/events/',
        query: {dataset: 'logs', per_page: '10'},
      })
    );
  });

  it('keeps lib scalar args for name-matched rules, not for route matchers', () => {
    // Route match predicates key on `path`, which lib calls lack — so passing scalar args is safe
    // for name-matched helpers like get_span_details, and cannot fire a path-matched issue rule.
    expect(
      subjectFromCallRecord({
        id: 1,
        kind: 'lib',
        name: 'code_search',
        params: {issue_id: '54'},
      })
    ).toEqual(
      expect.objectContaining({
        kind: 'lib',
        name: 'code_search',
        params: {issue_id: '54'},
        path: undefined,
      })
    );
    expect(
      resolveLink(
        subjectFromCallRecord({
          id: 1,
          kind: 'lib',
          name: 'code_search',
          params: {issue_id: '54'},
        }),
        ctx
      )
    ).toBeNull();
  });
});
