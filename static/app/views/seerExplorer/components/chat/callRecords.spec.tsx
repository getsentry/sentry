import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  callRecordDetail,
  callRecordLabel,
  callRecordStatus,
} from 'sentry/views/seerExplorer/callRecords';
import {BlockComponent} from 'sentry/views/seerExplorer/components/chat';
import type {Block, CallRecord} from 'sentry/views/seerExplorer/types';

/**
 * Code Mode call records.
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

/**
 * A block whose tool calls are still running: no results yet, so only in-flight reporting shows.
 */
function inFlightBlock(toolCallIds: string[], overrides: Partial<Block> = {}): Block {
  return {
    id: 'tool-1',
    message: {
      role: 'tool_use',
      content: null,
      tool_calls: toolCallIds.map(id => ({
        id,
        function: 'sentry_api_execute',
        args: '{"code":"..."}',
      })),
    },
    timestamp: '2024-01-01T00:01:00Z',
    loading: true,
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

  it('never shows the tool name when a Code Mode call reported nothing', () => {
    render(<BlockComponent block={codeModeBlock(undefined)} blockIndex={0} />);

    expect(screen.queryByText(/Used sentry_api_execute tool/)).not.toBeInTheDocument();
  });

  it('reports a record with no title rather than deleting it', () => {
    // Given a generic label rather than its route, but reported: a record vanishing for want of
    // wording is how a whole endpoint disappears the day it is added.
    const block = codeModeBlock([
      apiRecord({title: undefined, path: '/api/0/dropped/{thing_id}/'}),
      apiRecord({id: 2, title: 'List Your Organizations'}),
    ]);
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('List Your Organizations')).toBeInTheDocument();
    expect(screen.getByText('Sentry API request')).toBeInTheDocument();
  });

  it('keeps the request details on a described api row', () => {
    // The description leads the row, but an api call's own request is what makes that claim
    // checkable — swapping it for the generated title would lose the literal URL and the body.
    const record = apiRecord({
      llm_description: 'Working out which org owns the failing project',
      resolved_path: '/api/0/organizations/acme/',
    });

    expect(callRecordDetail(record)).toEqual({
      request: 'GET /api/0/organizations/acme/',
      body: null,
    });
  });

  it('falls back to the title for a described row that ran no request', () => {
    const record: CallRecord = {
      id: 1,
      parent: null,
      kind: 'lib',
      name: 'bash',
      title: 'Running command grep -rn retry in getsentry/sentry',
      llm_description: 'Checking whether the retry ceiling changed',
    };

    expect(callRecordDetail(record)).toEqual({
      request: 'Running command grep -rn retry in getsentry/sentry',
      body: null,
    });
  });

  it('leads with what the agent said the call was for', () => {
    const block = codeModeBlock([
      apiRecord({
        title: 'Retrieve an Organization',
        llm_description: 'Working out which org owns the failing project',
      }),
    ]);
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(
      screen.getByText('Working out which org owns the failing project')
    ).toBeInTheDocument();
  });

  it('keeps a described composite helper instead of only its requests', () => {
    // Without a description the children say more and the parent is dropped. With one, the parent
    // says what the operation was *for*, which none of the requests underneath can.
    const block = codeModeBlock([
      {
        id: 1,
        parent: null,
        kind: 'lib',
        name: 'get_issue_details',
        title: 'Getting enriched issue details for issue 4521',
        llm_description: 'Working out which span makes checkout slow',
      },
      apiRecord({id: 2, parent: 1, title: 'Retrieve an Issue'}),
    ]);
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(
      screen.getByText('Working out which span makes checkout slow')
    ).toBeInTheDocument();
    expect(screen.queryByText('Retrieve an Issue')).not.toBeInTheDocument();
  });

  it('drops an undescribed composite helper in favour of its requests', () => {
    const block = codeModeBlock([
      {
        id: 1,
        parent: null,
        kind: 'lib',
        name: 'get_issue_details',
        title: 'Getting enriched issue details for issue 4521',
      },
      apiRecord({id: 2, parent: 1, title: 'Retrieve an Issue'}),
    ]);
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('Retrieve an Issue')).toBeInTheDocument();
    expect(
      screen.queryByText('Getting enriched issue details for issue 4521')
    ).not.toBeInTheDocument();
  });

  it('renders a note in the order it was written', () => {
    const block = codeModeBlock([
      apiRecord({id: 1, title: 'Retrieve an Organization'}),
      {id: 2, parent: null, kind: 'note', llm_description: 'Comparing the two traces'},
      apiRecord({id: 3, title: 'List Your Organizations'}),
    ]);
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('Comparing the two traces')).toBeInTheDocument();
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

    expect(screen.getByRole('button', {name: 'View issue'})).toHaveAttribute(
      'href',
      expect.stringContaining('/issues/139458447/')
    );
  });

  describe('a row with a link and visible request detail', () => {
    /** An api call with a destination *and* a request to show — both present on one row. */
    function linkable(): CallRecord {
      return apiRecord({
        path: '/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/',
        resolved_path: '/api/0/organizations/acme/issues/139458447/',
        path_params: {organization_id_or_slug: 'acme', issue_id: '139458447'},
        title: 'Retrieve an Issue',
      });
    }

    it('renders the link chip separately from the title', () => {
      render(<BlockComponent block={codeModeBlock([linkable()])} blockIndex={0} />);

      expect(screen.getByRole('button', {name: 'View issue'})).toBeInTheDocument();
      expect(screen.getByText('Retrieve an Issue')).toBeInTheDocument();
    });

    it('shows the request detail without needing to expand', () => {
      render(<BlockComponent block={codeModeBlock([linkable()])} blockIndex={0} />);

      expect(
        screen.getByText('GET /api/0/organizations/acme/issues/139458447/')
      ).toBeInTheDocument();
    });
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

  it('drops a lib row whose api calls say more than it does', () => {
    const block = codeModeBlock([
      {
        id: 1,
        parent: null,
        kind: 'lib',
        name: 'get_issue_details',
        title: 'Retrieving details',
      },
      apiRecord({id: 2, parent: 1, title: 'Retrieving issue 54'}),
    ]);
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('Retrieving issue 54')).toBeInTheDocument();
    expect(screen.queryByText('Retrieving details')).not.toBeInTheDocument();
  });

  it('keeps get_span_details over its less-specific trace child', () => {
    // The only HTTP call under get_span_details is the trace endpoint. The lib row carries span_id
    // and is the better destination, so the child is suppressed rather than the parent.
    const block = codeModeBlock([
      {
        id: 1,
        parent: null,
        kind: 'lib',
        name: 'get_span_details',
        title: 'Retrieving span abc in trace def',
        params: {trace_id: 'def', span_id: 'abc'},
      },
      apiRecord({
        id: 2,
        parent: 1,
        path: '/api/0/organizations/{organization_id_or_slug}/trace/{trace_id}/',
        path_params: {organization_id_or_slug: 'acme', trace_id: 'def'},
        title: 'Retrieving waterfall for trace def',
      }),
    ]);
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('Retrieving span abc in trace def')).toBeInTheDocument();
    expect(
      screen.queryByText('Retrieving waterfall for trace def')
    ).not.toBeInTheDocument();
  });

  it('keeps a lib row that made no api calls of its own', () => {
    // code_search never touches the transport, so its row is the only trace it leaves. Seer titles
    // it, as it does every call — nothing in the frontend renames a row.
    const block = codeModeBlock([
      {
        id: 1,
        parent: null,
        kind: 'lib',
        name: 'code_search',
        title: 'Searching code in repository getsentry/sentry',
      },
    ]);
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(
      screen.getByText('Searching code in repository getsentry/sentry')
    ).toBeInTheDocument();
  });

  it('renders calls from separate tool calls the same as calls from one', () => {
    // How the run partitioned work into tool calls is invisible to the reader: one execute that
    // made two calls must look exactly like two that made one each.
    const rowsFor = (block: Block) => {
      const {unmount} = render(<BlockComponent block={block} blockIndex={0} />);
      const labels = screen.getAllByText(/call$/).map(node => node.textContent);
      unmount();
      return labels;
    };

    const together = rowsFor(
      codeModeBlock([
        apiRecord({id: 1, title: 'First call'}),
        apiRecord({id: 2, title: 'Second call'}),
      ])
    );
    const split = rowsFor({
      id: 'tool-1',
      message: {
        role: 'tool_use',
        content: null,
        tool_calls: [
          {id: 'call-1', function: 'sentry_api_execute', args: '{}'},
          {id: 'call-2', function: 'sentry_api_execute', args: '{}'},
        ],
      },
      timestamp: '2024-01-01T00:01:00Z',
      loading: false,
      tool_results: [
        {
          tool_call_id: 'call-1',
          tool_call_function: 'sentry_api_execute',
          content: 'ok',
          structuredContent: {calls: [apiRecord({id: 1, title: 'First call'})]},
        },
        {
          tool_call_id: 'call-2',
          tool_call_function: 'sentry_api_execute',
          content: 'ok',
          structuredContent: {calls: [apiRecord({id: 2, title: 'Second call'})]},
        },
      ],
    });

    expect(split).toEqual(together);
    expect(together).toEqual(['First call', 'Second call']);
  });

  it('renders no empty row when only trailing surfaces have content', () => {
    // `toolString` is blank for Code Mode, so a block kept alive by todos or markdown alone
    // used to render a labelless row — the lone status tick the hasContent guard exists to avoid.
    const block = codeModeBlock([]);
    block.tool_results![0]!.structuredContent = {
      todos: [{content: 'Check the trace', status: 'pending'}],
    };
    // findLatestTodos reads the block list, so the checklist only renders when the block is
    // reachable from it.
    render(<BlockComponent block={block} blockIndex={0} blocks={[block]} />);

    expect(screen.getByText('Check the trace')).toBeInTheDocument();
    // The symptom is a row that exists but says nothing: an empty label beside a status tick.
    // The tick is the only visible part, so assert it is absent — an empty label cannot be
    // queried by text.
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('img', {hidden: true})).toHaveLength(0);
  });

  it('renders no row at all for a Code Mode call that reported nothing', () => {
    // "Used sentry_api_execute tool" names none of the actions it covers, so it is never shown —
    // a call with nothing to report leaves no row rather than an empty one.
    render(<BlockComponent block={codeModeBlock([])} blockIndex={0} />);

    expect(screen.queryByText(/Used sentry_api_execute tool/)).not.toBeInTheDocument();
  });
});

describe('callRecordStatus', () => {
  it('reports success for a completed call', () => {
    expect(callRecordStatus(apiRecord({status: 200}), false)).toBe('success');
  });

  it('reports failure for an error status', () => {
    expect(callRecordStatus(apiRecord({status: 404}), false)).toBe('failure');
  });

  it('reports failure for a transport error', () => {
    expect(
      callRecordStatus(apiRecord({status: undefined, error: 'ConnectError'}), false)
    ).toBe('failure');
  });

  it('reports loading while the call is still open', () => {
    expect(callRecordStatus(apiRecord({status: undefined}), false)).toBe('loading');
  });

  it('settles a lib call that never reports a status', () => {
    // code_search / bash / ask_user_question never reach the HTTP transport, so a
    // completed record carries no status. Before the execute returns that means
    // still running; once it has returned, nothing is.
    const libRecord = {id: 1, kind: 'lib' as const, name: 'code_search'};
    expect(callRecordStatus(libRecord, false)).toBe('loading');
    expect(callRecordStatus(libRecord, true)).toBe('success');
  });

  it('keeps a settled failure a failure', () => {
    const failed = {id: 1, kind: 'lib' as const, name: 'bash', error: 'RuntimeError'};
    expect(callRecordStatus(failed, true)).toBe('failure');
  });

  it('gives each call its own outcome', () => {
    // One tick over a group cannot say which of three requests failed.
    const records = [
      apiRecord({id: 1, status: 200}),
      apiRecord({id: 2, status: 500}),
      apiRecord({id: 3, status: undefined}),
    ];

    expect(records.map(record => callRecordStatus(record, false))).toEqual([
      'success',
      'failure',
      'loading',
    ]);
  });
});

describe('callRecordLabel', () => {
  // Only the title. A rule in `links.tsx` may name the row instead, and where that wins over the
  // shipped title is settled in `links.spec.tsx` — not here.
  it('reports the shipped title verbatim, whatever the call was', () => {
    expect(
      callRecordLabel({
        id: 1,
        kind: 'lib',
        name: 'code_search',
        title: 'Ran a code search',
      })
    ).toBe('Ran a code search');
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

  it('shows the query string as part of the request line', () => {
    // Seer composes it into resolved_path, so the URL is the request — no param list beside it.
    const detail = callRecordDetail(
      apiRecord({
        resolved_path:
          '/api/0/organizations/sentry/issues/?query=is%3Aunresolved&limit=25',
      })
    );

    expect(detail?.request).toBe(
      'GET /api/0/organizations/sentry/issues/?query=is%3Aunresolved&limit=25'
    );
  });

  it('shows the request body', () => {
    const detail = callRecordDetail(
      apiRecord({method: 'PUT', body: '{\n  "status": "resolved"\n}'})
    );

    expect(detail?.body).toContain('"status": "resolved"');
  });

  it('marks a truncated body', () => {
    const detail = callRecordDetail(apiRecord({body: '{"a":1', body_truncated: true}));

    expect(detail?.body?.endsWith('…')).toBe(true);
  });

  it('has no body for a call that sent none', () => {
    expect(callRecordDetail(apiRecord())?.body).toBeNull();
  });

  it('has no detail for a lib call, even when it carries arguments', () => {
    // A lib row is a heading for the api rows nested under it, and those carry the detail — an
    // expander here would reveal less than what is already visible below.
    expect(
      callRecordDetail({
        id: 1,
        kind: 'lib',
        name: 'get_issue_details',
        params: {org: 'acme', issue_id: '54'},
      })
    ).toBeNull();
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

describe('in-flight progress', () => {
  it('shows work as it happens for a running tool call', () => {
    const block = inFlightBlock(['call-1'], {
      progress: [{token: 'call-1', progress: 1, message: 'Retrieving issue 4521'}],
    });
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('Retrieving issue 4521')).toBeInTheDocument();
  });

  it('reports both calls when two are in flight at once', () => {
    // The block-level mirror could not say which outstanding call its records belonged to, so it
    // showed them on neither — the agent looked hung while it worked. An event names its own call.
    const block = inFlightBlock(['call-1', 'call-2'], {
      progress: [
        {
          token: 'call-1',
          progress: 1,
          message: 'Searching the filesystem for retry logic',
        },
        {
          token: 'call-2',
          progress: 1,
          message: 'Querying telemetry for the p95 regression',
        },
      ],
    });
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(
      screen.getByText('Searching the filesystem for retry logic')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Querying telemetry for the p95 regression')
    ).toBeInTheDocument();
  });

  it('falls back to the block mirror when a seer sends no progress', () => {
    const block = inFlightBlock(['call-1'], {
      live_calls: [apiRecord({title: 'Retrieve an Organization'})],
    });
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('Retrieve an Organization')).toBeInTheDocument();
  });
});
