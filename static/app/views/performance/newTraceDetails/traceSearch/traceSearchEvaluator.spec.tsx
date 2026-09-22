import {OrganizationFixture} from 'sentry-fixture/organization';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {makeEAPSpan} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {searchInTraceTreeTokens} from 'sentry/views/performance/newTraceDetails/traceSearch/traceSearchEvaluator';
import {parseTraceSearch} from 'sentry/views/performance/newTraceDetails/traceSearch/traceTokenConverter';

const search = (query: string, tree: TraceTree, cb: any) => {
  searchInTraceTreeTokens(tree, parseTraceSearch(query) as any, null, cb);
};
const organization = OrganizationFixture();

describe('TraceSearchEvaluator', () => {
  describe('eap span', () => {
    it('text filter', async () => {
      const tree = TraceTree.FromTrace(
        [makeEAPSpan({op: 'db'}), makeEAPSpan({op: 'http'})],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('op:db', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('text filter with prefix', async () => {
      const tree = TraceTree.FromTrace(
        [makeEAPSpan({op: 'db'}), makeEAPSpan({op: 'http'})],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('span.op:db', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('span.duration (milliseconds)', async () => {
      const tree = TraceTree.FromTrace(
        [
          makeEAPSpan({start_timestamp: 0, end_timestamp: 1}),
          makeEAPSpan({start_timestamp: 0, end_timestamp: 0.5}),
        ],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('span.duration:>500ms', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('span.duration (seconds)', async () => {
      const tree = TraceTree.FromTrace(
        [
          makeEAPSpan({start_timestamp: 0, end_timestamp: 1}),
          makeEAPSpan({start_timestamp: 0, end_timestamp: 0.5}),
        ],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('span.duration:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('span.total_time', async () => {
      const tree = TraceTree.FromTrace(
        [
          makeEAPSpan({start_timestamp: 0, end_timestamp: 1}),
          makeEAPSpan({start_timestamp: 0, end_timestamp: 0.5}),
        ],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('span.total_time:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('name filter', async () => {
      const tree = TraceTree.FromTrace(
        [makeEAPSpan({name: 'authentication'}), makeEAPSpan({name: 'database'})],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('name:authentication', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('name filter with prefix', async () => {
      const tree = TraceTree.FromTrace(
        [makeEAPSpan({name: 'authentication'}), makeEAPSpan({name: 'database'})],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('span.name:authentication', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('name free text search', async () => {
      const tree = TraceTree.FromTrace(
        [
          makeEAPSpan({name: 'user_authentication_service', op: 'http'}),
          makeEAPSpan({name: 'database_query', op: 'db'}),
        ],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('authentication', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('AND query', async () => {
      const tree = TraceTree.FromTrace(
        [
          makeEAPSpan({op: 'db', name: 'query'}),
          makeEAPSpan({op: 'db', name: 'insert'}),
          makeEAPSpan({op: 'http', name: 'query'}),
        ],
        {meta: null, replay: null, organization}
      );

      tree.build();
      const cb = jest.fn();
      search('op:db AND name:query', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());

      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
    });

    it('OR query', async () => {
      const tree = TraceTree.FromTrace(
        [makeEAPSpan({op: 'db'}), makeEAPSpan({op: 'http'}), makeEAPSpan({op: 'cache'})],
        {meta: null, replay: null, organization}
      );

      tree.build();
      const cb = jest.fn();
      search('op:db OR op:http', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());

      expect(cb.mock.calls[0][0][0]).toEqual([
        {index: 1, value: tree.list[1]},
        {index: 2, value: tree.list[2]},
      ]);
    });

    it('OR with AND respects precedence', async () => {
      const tree = TraceTree.FromTrace(
        [
          makeEAPSpan({op: 'db', name: 'query'}),
          makeEAPSpan({op: 'db', name: 'insert'}),
          makeEAPSpan({op: 'http', name: 'request'}),
        ],
        {meta: null, replay: null, organization}
      );

      tree.build();
      const cb = jest.fn();
      search('op:db AND name:query OR op:http', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());

      expect(cb.mock.calls[0][0][0]).toEqual([
        {index: 1, value: tree.list[1]},
        {index: 3, value: tree.list[3]},
      ]);
    });

    it.each(['', 'invalid_query:', 'OR', 'op:db AND'])(
      'invalid query %s',
      async query => {
        const tree = TraceTree.FromTrace([makeEAPSpan({op: 'db'})], {
          meta: null,
          replay: null,
          organization,
        });
        const cb = jest.fn();

        search(query, tree, cb);
        await waitFor(() => expect(cb).toHaveBeenCalled());

        expect(cb.mock.calls[0][0][0]).toEqual([]);
        expect(cb.mock.calls[0][0][1].size).toBe(0);
        expect(cb.mock.calls[0][0][2]).toBeNull();
      }
    );
  });
});
