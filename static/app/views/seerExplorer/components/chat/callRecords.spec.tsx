import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  callRecordDetail,
  callRecordLabel,
  callRecordUrl,
} from 'sentry/views/seerExplorer/callRecords';
import {BlockComponent} from 'sentry/views/seerExplorer/components/chat';
import type {Block, CallRecord} from 'sentry/views/seerExplorer/types';

/**
 * Code Mode call records (openspec: codemode-call-visibility).
 *
 * `sentry_api_execute` covers every action Code Mode can take, so the row is built from the calls
 * the execute reported rather than from the tool's name.
 */
function codeModeBlock(calls: CallRecord[] | undefined): Block {
  return {
    id: 'tool-1',
    message: {
      role: 'tool_use',
      content: null,
      tool_calls: [
        {id: 'call-1', function: 'sentry_api_execute', args: '{"code":"..."}'},
      ],
    },
    timestamp: '2024-01-01T00:01:00Z',
    loading: false,
    tool_results: [
      {
        tool_call_id: 'call-1',
        tool_call_function: 'sentry_api_execute',
        content: 'ok',
        structuredContent: calls ? {calls} : undefined,
      },
    ],
  };
}

function apiRecord(overrides?: Partial<CallRecord>): CallRecord {
  return {
    id: 1,
    parent: null,
    kind: 'api',
    method: 'GET',
    path: '/api/0/organizations/{organization_id_or_slug}/',
    path_params: {organization_id_or_slug: 'acme'},
    title: 'Retrieve an Organization',
    status: 200,
    ...overrides,
  };
}

describe('call record rendering', () => {
  it('renders a row per call using the title seer shipped', () => {
    const block = codeModeBlock([
      apiRecord(),
      apiRecord({id: 2, title: 'List Your Organizations'}),
    ]);
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('Retrieve an Organization')).toBeInTheDocument();
    expect(screen.getByText('List Your Organizations')).toBeInTheDocument();
  });

  it('replaces the generic tool row rather than sitting beside it', () => {
    render(<BlockComponent block={codeModeBlock([apiRecord()])} blockIndex={0} />);

    expect(screen.queryByText(/Used sentry_api_execute tool/)).not.toBeInTheDocument();
  });

  it('falls back to the generic row when no records are present', () => {
    render(<BlockComponent block={codeModeBlock(undefined)} blockIndex={0} />);

    expect(screen.getByText(/Used sentry_api_execute tool/)).toBeInTheDocument();
  });

  it('falls back to the generic row when records are empty', () => {
    render(<BlockComponent block={codeModeBlock([])} blockIndex={0} />);

    expect(screen.getByText(/Used sentry_api_execute tool/)).toBeInTheDocument();
  });

  it('drops a record with no title rather than showing its route', () => {
    // The surviving row's expansion legitimately shows a route, so assert on the row count:
    // the titleless record contributes nothing rather than falling back to its path.
    const block = codeModeBlock([
      apiRecord({title: undefined, path: '/api/0/dropped/{thing_id}/'}),
      apiRecord({id: 2, title: 'List Your Organizations'}),
    ]);
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('List Your Organizations')).toBeInTheDocument();
    expect(screen.queryByText(/dropped/)).not.toBeInTheDocument();
  });

  it('links a record that identifies a navigable resource', () => {
    const block = codeModeBlock([
      apiRecord({
        path: '/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/',
        path_params: {organization_id_or_slug: 'acme', issue_id: '139458447'},
        title: 'Retrieve an Issue',
      }),
    ]);
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByRole('link', {name: /Retrieve an Issue/})).toHaveAttribute(
      'href',
      expect.stringContaining('/issues/139458447/')
    );
  });

  it('renders a record with no navigable resource as plain text', () => {
    render(<BlockComponent block={codeModeBlock([apiRecord()])} blockIndex={0} />);

    expect(screen.getByText('Retrieve an Organization')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: /Retrieve an Organization/})
    ).not.toBeInTheDocument();
  });

  it('does not fail the block on an unrecognized record shape', () => {
    const block = codeModeBlock([{id: 1, kind: 'api'}]);

    expect(() => render(<BlockComponent block={block} blockIndex={0} />)).not.toThrow();
  });

  it('renders lib records alongside api records', () => {
    const block = codeModeBlock([
      {id: 1, parent: null, kind: 'lib', name: 'code_search'},
      apiRecord({id: 2, parent: 1}),
    ]);
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('Searched code')).toBeInTheDocument();
    expect(screen.getByText('Retrieve an Organization')).toBeInTheDocument();
  });
});

describe('callRecordLabel', () => {
  it('prefers a registered handler over the shipped title', () => {
    const label = callRecordLabel({
      id: 1,
      kind: 'lib',
      name: 'code_search',
      title: 'Should not win',
    });

    expect(label).toBe('Searched code');
  });

  it('uses the shipped title when no handler matches', () => {
    expect(callRecordLabel(apiRecord())).toBe('Retrieve an Organization');
  });

  it('returns null rather than a raw identifier when there is nothing to show', () => {
    expect(
      callRecordLabel({id: 1, kind: 'api', method: 'GET', path: '/api/0/x/'})
    ).toBeNull();
  });

  it('treats a blank title as absent', () => {
    expect(callRecordLabel(apiRecord({title: '   '}))).toBeNull();
  });
});

describe('callRecordUrl', () => {
  const organization = OrganizationFixture();

  it('builds an issue URL from an issue_id path param', () => {
    const url = callRecordUrl(
      apiRecord({path_params: {organization_id_or_slug: 'acme', issue_id: '42'}}),
      organization
    );

    expect(url).not.toBeNull();
  });

  it('scopes an org-less path to the organization', () => {
    // A bare `/issues/42/` only resolves under a customer domain, so it 404s on a plain host.
    const url = callRecordUrl(apiRecord({path_params: {issue_id: '42'}}), organization);

    expect(url).toEqual(
      expect.objectContaining({
        pathname: `/organizations/${organization.slug}/issues/42/`,
      })
    );
  });

  it('does not double-prefix a path that is already org-scoped', () => {
    const url = callRecordUrl(
      apiRecord({
        path: '/api/0/organizations/{organization_id_or_slug}/replays/{replay_id}/',
        path_params: {organization_id_or_slug: 'acme', replay_id: 'r1'},
      }),
      organization
    );

    expect(JSON.stringify(url)).not.toContain('/organizations/acme/organizations/');
  });

  it('prefers the event URL when a record names both an issue and an event', () => {
    const url = callRecordUrl(
      apiRecord({
        path_params: {issue_id: '42', event_id: 'abc123'},
      }),
      organization
    );

    expect(JSON.stringify(url)).toContain('abc123');
  });

  it('returns null when only scope params are present', () => {
    // organization/project slugs say where a call went, not what it points at.
    expect(
      callRecordUrl(
        apiRecord({
          path_params: {organization_id_or_slug: 'acme', project_id_or_slug: 'web'},
        }),
        organization
      )
    ).toBeNull();
  });

  it('returns null when a record has no path params', () => {
    expect(callRecordUrl(apiRecord({path_params: undefined}), organization)).toBeNull();
  });

  describe('only the route its own subject', () => {
    // Without this, get_issue_details' three requests all link to the issue page — three rows
    // pointing at the same place, which reads as arbitrary.
    const issueRoutes = [
      ['/api/0/issues/{issue_id}/', true],
      ['/api/0/issues/{issue_id}/events/latest/', false],
      ['/api/0/issues/{issue_id}/tags/', false],
    ] as const;

    it.each(issueRoutes)('%s links: %s', (path, shouldLink) => {
      const url = callRecordUrl(
        apiRecord({path, path_params: {issue_id: '54'}}),
        organization
      );

      expect(url === null).toBe(!shouldLink);
    });

    it('gives one link across a lib call and its children', () => {
      const linked = issueRoutes
        .map(([path]) =>
          callRecordUrl(apiRecord({path, path_params: {issue_id: '54'}}), organization)
        )
        .filter(Boolean);

      expect(linked).toHaveLength(1);
    });
  });
  describe('api-only aliases', () => {
    // The API resolves `latest`/`oldest`/`recommended` server-side, but the UI route needs a
    // concrete id — linking the alias straight through produces a dead page.
    it('does not link an event alias as if it were an event id', () => {
      const url = callRecordUrl(
        apiRecord({
          path: '/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/events/{event_id}/',
          path_params: {
            organization_id_or_slug: 'sentry',
            issue_id: '54',
            event_id: 'latest',
          },
        }),
        organization
      );

      expect(JSON.stringify(url)).not.toContain('latest');
    });

    it('falls back to the issue when the event is an alias', () => {
      const url = callRecordUrl(
        apiRecord({path_params: {issue_id: '54', event_id: 'latest'}}),
        organization
      );

      expect(url).toEqual(
        expect.objectContaining({
          pathname: `/organizations/${organization.slug}/issues/54/`,
        })
      );
    });

    it.each(['latest', 'oldest', 'recommended'])('rejects %s as an event id', alias => {
      const url = callRecordUrl(
        apiRecord({path_params: {issue_id: '54', event_id: alias}}),
        organization
      );

      expect(JSON.stringify(url)).not.toContain(alias);
    });

    it('still links a real event id', () => {
      const url = callRecordUrl(
        apiRecord({path_params: {issue_id: '54', event_id: 'abc123'}}),
        organization
      );

      expect(JSON.stringify(url)).toContain('abc123');
    });
  });
});

describe('callRecordDetail', () => {
  it('shows the path actually requested, not the template', () => {
    const detail = callRecordDetail(
      apiRecord({
        path: '/api/0/issues/{issue_id}/tags/',
        resolved_path: '/api/0/issues/54/tags/',
      })
    );

    expect(detail?.request).toBe('GET /api/0/issues/54/tags/');
  });

  it('lists query params', () => {
    const detail = callRecordDetail(
      apiRecord({query_params: {statsPeriod: '14d', environment: 'prod'}})
    );

    expect(detail?.params).toEqual([
      ['statsPeriod', '14d'],
      ['environment', 'prod'],
    ]);
  });

  it('reports a transport failure over a status', () => {
    expect(callRecordDetail(apiRecord({error: 'ConnectError'}))?.status).toBe(
      'ConnectError'
    );
  });

  it('reports pending while the call is in flight', () => {
    expect(callRecordDetail(apiRecord({status: undefined}))?.status).toBe('pending');
  });

  it('has no detail for a lib call, which has no route of its own', () => {
    expect(callRecordDetail({id: 1, kind: 'lib', name: 'get_issue_details'})).toBeNull();
  });
});

describe('live call rendering', () => {
  function liveBlock(overrides?: Partial<Block>): Block {
    return {
      id: 'tool-1',
      message: {
        role: 'tool_use',
        content: null,
        tool_calls: [
          {id: 'call-1', function: 'sentry_api_execute', args: '{"code":"..."}'},
        ],
      },
      timestamp: '2024-01-01T00:01:00Z',
      loading: true,
      tool_results: [],
      ...overrides,
    };
  }

  it('shows calls from the in-flight block before any result exists', () => {
    const block = liveBlock({
      live_calls: [apiRecord({title: 'Retrieve an Organization', status: undefined})],
    });
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('Retrieve an Organization')).toBeInTheDocument();
  });

  it('prefers the finished result over the live mirror once it lands', () => {
    const block = liveBlock({
      loading: false,
      live_calls: [apiRecord({title: 'Stale live row'})],
      tool_results: [
        {
          tool_call_id: 'call-1',
          tool_call_function: 'sentry_api_execute',
          content: 'ok',
          structuredContent: {calls: [apiRecord({title: 'Final row'})]},
        },
      ],
    });
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('Final row')).toBeInTheDocument();
    expect(screen.queryByText('Stale live row')).not.toBeInTheDocument();
  });

  it('does not duplicate the mirror across several in-flight calls', () => {
    // The mirror is per block, so with two calls outstanding there is no way to say whose it is.
    const block = liveBlock({
      message: {
        role: 'tool_use',
        content: null,
        tool_calls: [
          {id: 'call-1', function: 'sentry_api_execute', args: '{}'},
          {id: 'call-2', function: 'sentry_api_execute', args: '{}'},
        ],
      },
      live_calls: [apiRecord({title: 'Ambiguous row'})],
    });
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.queryByText('Ambiguous row')).not.toBeInTheDocument();
  });

  it('attributes the mirror to the one call still outstanding', () => {
    const block = liveBlock({
      message: {
        role: 'tool_use',
        content: null,
        tool_calls: [
          {id: 'call-1', function: 'sentry_api_execute', args: '{}'},
          {id: 'call-2', function: 'sentry_api_execute', args: '{}'},
        ],
      },
      tool_results: [
        {
          tool_call_id: 'call-1',
          tool_call_function: 'sentry_api_execute',
          content: 'ok',
        },
      ],
      live_calls: [apiRecord({title: 'In-flight row'})],
    });
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('In-flight row')).toBeInTheDocument();
  });
});
