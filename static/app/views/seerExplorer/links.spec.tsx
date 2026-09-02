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
 * tests below assert every rule is reachable under longest-prefix selection (or by name).
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
  get_dashboard_details: {
    kind: 'api',
    method: 'GET',
    path: '/api/0/organizations/{organization_id_or_slug}/dashboards/{dashboard_id}/',
    params: {dashboard_id: '123'},
  },
  get_release_details: {
    kind: 'api',
    method: 'GET',
    path: '/api/0/organizations/{organization_id_or_slug}/releases/{version}/',
    params: {version: '1.2.3'},
  },
  get_detector_details: {
    kind: 'api',
    method: 'GET',
    path: '/api/0/organizations/{organization_id_or_slug}/detectors/{detector_id}/',
    params: {detector_id: '4521'},
  },
  get_workflow_details: {
    kind: 'api',
    method: 'GET',
    path: '/api/0/organizations/{organization_id_or_slug}/workflows/{workflow_id}/',
    params: {workflow_id: '881'},
  },
  get_cron_monitor_details: {
    kind: 'api',
    method: 'GET',
    path: '/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/monitors/{monitor_id_or_slug}/',
    params: {project_id_or_slug: 'javascript', monitor_id_or_slug: 'nightly-sync'},
  },
  get_issue_alert_rule: {
    kind: 'api',
    method: 'GET',
    path: '/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/rules/{rule_id}/',
    params: {project_id_or_slug: 'javascript', rule_id: '99'},
  },
  get_member_details: {
    kind: 'api',
    method: 'GET',
    path: '/api/0/organizations/{organization_id_or_slug}/members/{member_id}/',
    params: {member_id: '7'},
  },
  get_team_details: {
    kind: 'api',
    method: 'GET',
    path: '/api/0/teams/{organization_id_or_slug}/{team_id_or_slug}/',
    params: {team_id_or_slug: 'frontend'},
  },
  get_project_event: {
    kind: 'api',
    method: 'GET',
    path: '/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/events/{event_id}/',
    params: {project_id_or_slug: 'javascript', event_id: 'deadbeef'},
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

  // Longest-prefix selection (or name match) must still land each example on its own rule. A more
  // generic prefix that ends further right would steal it; a missing prefix would leave it null.
  it.each(LINK_RULES.map(rule => [rule.id] as const))(
    '%s is reachable, and resolves its example',
    id => {
      const subject = LINK_RULE_EXAMPLES[id]!;
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

  // `/issues/{issue_id}/events/latest/` is not a concrete event (API-only alias), so the event rule
  // declines. Longest-prefix still finds `/issues/{issue_id}/` and links the issue page instead of
  // leaving the row dead — better than a 404 event URL, and matches nested issue inheritance.
  it('falls back from an API-only event alias to the issue page', () => {
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
    ).toEqual({
      id: 'get_issue_details',
      label: 'Retrieve the Latest Event',
      url: {pathname: '/organizations/org-slug/issues/54/', query: {}},
    });
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

describe('entity links added for Code Mode API coverage', () => {
  it('links a dashboard to the singular dashboard route', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'GET',
          path: '/api/0/organizations/{organization_id_or_slug}/dashboards/{dashboard_id}/',
          params: {dashboard_id: '123'},
          title: 'Retrieve a Dashboard',
        },
        ctx
      )
    ).toEqual({
      id: 'get_dashboard_details',
      label: 'Retrieve a Dashboard',
      url: {pathname: '/organizations/org-slug/dashboard/123/'},
    });
  });

  it('links a release, pinning project when the call carried one', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'GET',
          path: '/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/releases/{version}/',
          params: {project_id_or_slug: '2', version: '1.2.3'},
        },
        ctx
      )
    ).toEqual({
      id: 'get_release_details',
      label: 'View release',
      url: {
        pathname: '/organizations/org-slug/explore/releases/1.2.3/',
        query: {project: '2'},
      },
    });
  });

  it('links a detector and a workflow onto the monitors surfaces', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'GET',
          path: '/api/0/organizations/{organization_id_or_slug}/detectors/{detector_id}/',
          params: {detector_id: '4521'},
        },
        ctx
      )?.url
    ).toEqual({pathname: '/organizations/org-slug/monitors/4521/'});

    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'GET',
          path: '/api/0/organizations/{organization_id_or_slug}/workflows/{workflow_id}/',
          params: {workflow_id: '881'},
        },
        ctx
      )?.url
    ).toEqual({pathname: '/organizations/org-slug/monitors/alerts/881/'});
  });

  it('leaves an org-level cron monitor unlinked without a project to pin', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'GET',
          path: '/api/0/organizations/{organization_id_or_slug}/monitors/{monitor_id_or_slug}/',
          params: {monitor_id_or_slug: 'nightly-sync'},
        },
        ctx
      )
    ).toBeNull();
  });

  it('treats nested team membership as the member, not the team page', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'PUT',
          path: '/api/0/organizations/{organization_id_or_slug}/members/{member_id}/teams/{team_id_or_slug}/',
          params: {member_id: '7', team_id_or_slug: 'frontend'},
        },
        ctx
      )?.id
    ).toBe('get_member_details');
  });

  it('routes a project event through ProjectEventRedirect when no issue id is present', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'GET',
          path: '/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/events/{event_id}/',
          params: {project_id_or_slug: 'javascript', event_id: 'deadbeef'},
        },
        ctx
      )
    ).toEqual({
      id: 'get_project_event',
      label: 'View event',
      url: {pathname: '/organizations/org-slug/projects/javascript/events/deadbeef/'},
    });
  });

  it('keeps settings destinations off the /organizations prefix', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'GET',
          path: '/api/0/organizations/{organization_id_or_slug}/members/{member_id}/',
          params: {member_id: '7'},
        },
        ctx
      )?.url
    ).toEqual({pathname: '/settings/org-slug/members/7/'});
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

  it('leads a navigable row with the agent line, not the generated title', () => {
    // Without this the agent's own words are dropped on exactly the rows this is meant to
    // elevate: any record a link rule matched.
    expect(
      resolveLink(
        subjectFromCallRecord({
          ...record({project_id_or_slug: 'python'}),
          llm_description: 'Checking whether the python project still ingests',
        }),
        ctx
      )
    ).toEqual({
      id: 'get_project_details',
      label: 'Checking whether the python project still ingests',
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

  // Weekly-report exclusions sit under `/organizations/…/…/{project_id_or_slug}/`, not the
  // `/projects/{org}/{project}/` prefix, so the project rule never claims them. DELETE also blocks.
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

describe('longest path prefix inheritance', () => {
  it('still opens the waterfall for legacy events-trace routes', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'GET',
          path: '/api/0/organizations/{organization_id_or_slug}/events-trace/{trace_id}/',
          params: {trace_id: 'trace1'},
          title: 'Retrieve a Trace',
        },
        ctx
      )
    ).toEqual({
      id: 'get_trace_waterfall',
      label: 'Retrieve a Trace',
      url: {pathname: '/organizations/org-slug/explore/traces/trace/trace1/', query: {}},
    });
  });

  it('links nested issue subresources to the issue page', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'GET',
          path: '/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/tags/{key}/',
          params: {issue_id: '54', key: 'browser'},
          title: "List an Issue's Tags",
        },
        ctx
      )
    ).toEqual({
      id: 'get_issue_details',
      label: "List an Issue's Tags",
      url: {pathname: '/organizations/org-slug/issues/54/', query: {}},
    });
  });

  it('prefers a release over the project root on nested release paths', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'GET',
          path: '/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/releases/{version}/files/',
          params: {project_id_or_slug: 'javascript', version: '1.2.3'},
        },
        ctx
      )?.id
    ).toBe('get_release_details');
  });

  it('prefers project event over the bare project root', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'GET',
          path: '/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/events/{event_id}/attachments/',
          params: {project_id_or_slug: 'javascript', event_id: 'deadbeef'},
        },
        ctx
      )?.id
    ).toBe('get_project_event');
  });

  it('links nested project hooks to the project page', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'GET',
          path: '/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/hooks/{hook_id}/',
          params: {project_id_or_slug: 'javascript', hook_id: '9'},
          title: 'Retrieve a Service Hook',
        },
        ctx
      )
    ).toEqual({
      id: 'get_project_details',
      label: 'Retrieve a Service Hook',
      url: {pathname: '/organizations/org-slug/insights/projects/javascript/'},
    });
  });

  it('still prefers member over team on nested membership paths', () => {
    expect(
      resolveLink(
        {
          kind: 'api',
          method: 'PUT',
          path: '/api/0/organizations/{organization_id_or_slug}/members/{member_id}/teams/{team_id_or_slug}/',
          params: {member_id: '7', team_id_or_slug: 'frontend'},
        },
        ctx
      )?.id
    ).toBe('get_member_details');
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

  // A search row starts with only dataset + question. Without the translated query the rule
  // declines rather than manufacturing a destination out of the name alone; residual bus links
  // still cover older runs.
  it('does not link a search row that has no translated query yet', () => {
    const subject = subjectFromCallRecord({
      id: 1,
      kind: 'lib',
      name: 'telemetry_live_search',
      params: {dataset: 'spans', question: 'top pageloads'},
    });
    expect(resolveLink(subject, ctx)).toBeNull();
  });

  it('links a search row once seer stamped the translated query onto it', () => {
    const result = resolveLink(
      subjectFromCallRecord({
        id: 1,
        kind: 'lib',
        name: 'telemetry_live_search',
        title:
          'Querying issues for unresolved issues related to logs page in the last 7 days',
        params: {
          dataset: 'issues',
          question: 'unresolved issues related to logs page in the last 7 days',
          query: 'is:unresolved logs',
          stats_period: '7d',
        },
      }),
      ctx
    );

    expect(result).toEqual({
      id: 'telemetry_live_search',
      label:
        'Querying issues for unresolved issues related to logs page in the last 7 days',
      url: {
        pathname: '/organizations/org-slug/issues/',
        query: {
          query: 'is:unresolved logs',
          project: null,
          statsPeriod: '7d',
        },
      },
    });
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
