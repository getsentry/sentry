import {QueryClientProvider} from '@tanstack/react-query';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {Block, CallRecord, SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

import {useRefreshPageOnSeerWrite} from './useRefreshPageOnSeerWrite';

function makeBlock(id: string, calls: CallRecord[]): Block {
  return {
    id,
    timestamp: '2026-01-01T00:00:00Z',
    message: {role: 'tool_use', content: null},
    tool_results: [
      {
        content: '',
        tool_call_function: 'sentry_api_execute',
        tool_call_id: `call-${id}`,
        structuredContent: {calls},
      },
    ],
  };
}

const createAlert: CallRecord = {
  id: 1,
  kind: 'api',
  method: 'POST',
  path: '/api/0/organizations/{organization_id_or_slug}/workflows/',
  status: 201,
};

const listIssues: CallRecord = {
  id: 1,
  kind: 'api',
  method: 'GET',
  path: '/api/0/organizations/{organization_id_or_slug}/issues/',
  status: 200,
};

function renderRefreshHook(initialBlocks: Block[] | undefined) {
  const queryClient = makeTestQueryClient();
  const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
  const hook = renderHook(useRefreshPageOnSeerWrite, {
    initialProps: {runId: 1 as SeerExplorerRunId, blocks: initialBlocks},
    wrapper: ({children}) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  return {...hook, invalidateQueries};
}

describe('useRefreshPageOnSeerWrite', () => {
  it('invalidates queries when a new successful write appears', () => {
    const {rerender, invalidateQueries} = renderRefreshHook([makeBlock('a', [])]);

    rerender({runId: 1, blocks: [makeBlock('a', []), makeBlock('b', [createAlert])]});
    expect(invalidateQueries).toHaveBeenCalledTimes(1);

    // The same write on a later poll is not new.
    rerender({runId: 1, blocks: [makeBlock('a', []), makeBlock('b', [createAlert])]});
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('ignores reads, failed writes, and external provider writes', () => {
    const {rerender, invalidateQueries} = renderRefreshHook([]);

    rerender({
      runId: 1,
      blocks: [
        makeBlock('a', [
          listIssues,
          {...createAlert, id: 2, status: 400},
          {...createAlert, id: 3, status: undefined, error: 'ConnectError'},
          {...createAlert, id: 4, provider: 'github'},
        ]),
      ],
    });
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('skips writes already in a run when it is first loaded', () => {
    const {rerender, invalidateQueries} = renderRefreshHook(undefined);

    rerender({runId: 1, blocks: [makeBlock('a', [createAlert])]});
    rerender({runId: 2, blocks: [makeBlock('b', [createAlert])]});
    expect(invalidateQueries).not.toHaveBeenCalled();

    rerender({
      runId: 2,
      blocks: [makeBlock('b', [createAlert]), makeBlock('c', [createAlert])],
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });
});
