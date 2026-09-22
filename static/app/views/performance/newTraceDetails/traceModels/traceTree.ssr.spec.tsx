import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  makeEAPSpan,
  makeEAPTrace,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {TraceTree} from './traceTree';

const organization = OrganizationFixture();
const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;
const traceMetadata = {replay: null, organization};
const ssrEAPTrace = makeEAPTrace([
  makeEAPSpan({
    event_id: '000',
    op: 'http.server',
    start_timestamp: start,
    end_timestamp: start + 2,
    is_transaction: true,
    children: [
      makeEAPSpan({
        event_id: '001',
        op: 'pageload',
        start_timestamp: start,
        end_timestamp: start + 2,
        is_transaction: true,
        parent_span_id: '000',
        children: [
          makeEAPSpan({
            op: 'tls.connect',
            start_timestamp: start,
            end_timestamp: start + 2,
          }),
          makeEAPSpan({
            op: 'browser.request',
            description: 'browser',
            start_timestamp: start,
            end_timestamp: start + 2,
          }),
        ],
      }),
    ],
  }),
]);

describe('server side rendering', () => {
  describe('eap traces', () => {
    it('reparents pageload transaction as parent of server handler', () => {
      const tree = TraceTree.FromTrace(ssrEAPTrace, traceMetadata);

      const pageload = tree.root.children[0]!.children[0]!;
      const serverHandler = pageload.children[0]!;

      expect(serverHandler.parent).toBe(pageload);
      expect(pageload.parent).toBe(tree.root.children[0]);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('reparents server handler under browser request span', () => {
      const tree = TraceTree.FromTrace(ssrEAPTrace, traceMetadata);

      const pageload = tree.root.children[0]!.children[0]!;
      pageload.expand(true, tree);

      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });
});
