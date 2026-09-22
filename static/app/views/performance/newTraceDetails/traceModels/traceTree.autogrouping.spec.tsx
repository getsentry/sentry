import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {
  makeEAPSpan,
  makeEAPTrace,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {TraceTree} from './traceTree';

const organization = OrganizationFixture();
const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;
const traceMetadata = {replay: null, organization};
const options = {organization};
const parentAutogroupEAPSpans = [
  makeEAPSpan({
    op: 'db',
    description: 'redis',
    event_id: '0000',
    children: [
      makeEAPSpan({
        op: 'db',
        description: 'redis',
        event_id: '0001',
        parent_span_id: '0000',
        children: [
          makeEAPSpan({
            op: 'db',
            description: 'redis',
            event_id: '0002',
            parent_span_id: '0001',
          }),
        ],
      }),
    ],
  }),
];
const siblingAutogroupEAPSpans = [
  makeEAPSpan({
    op: 'http.server',
    description: 'redis',
    event_id: '0000',
    children: Array.from({length: 5}, (_, index) =>
      makeEAPSpan({
        event_id: `000${index + 1}`,
        op: 'db',
        description: 'redis',
        start_timestamp: start,
        end_timestamp: start + 1,
        parent_span_id: '0000',
      })
    ),
  }),
];

describe('autogrouping', () => {
  describe('parent autogrouping', () => {
    it('groups parent chain with same op', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace(parentAutogroupEAPSpans),
        traceMetadata
      );

      TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('assigns children to tail node', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            op: 'db',
            description: 'redis',
            event_id: '0000',
            children: [
              makeEAPSpan({
                op: 'db',
                description: 'redis',
                event_id: '0001',
                parent_span_id: '0000',
                children: [
                  makeEAPSpan({
                    op: 'db',
                    description: 'redis',
                    event_id: '0002',
                    parent_span_id: '0001',
                    children: [
                      makeEAPSpan({
                        op: 'http.server',
                        description: 'redis',
                        event_id: '0003',
                        parent_span_id: '0002',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ]),
        traceMetadata
      );

      TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('does not autogroup gen_ai parent chains', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'root',
            op: 'gen_ai.chat',
            description: 'chat',
            children: [
              makeEAPSpan({
                event_id: 'child',
                op: 'gen_ai.chat',
                description: 'chat',
                parent_span_id: 'root',
              }),
            ],
          }),
        ]),
        traceMetadata
      );

      expect(TraceTree.AutogroupDirectChildrenSpanNodes(tree.root)).toBe(0);
      expect(tree.root.findChild(isParentAutogroupedNode)).toBeNull();
    });

    it('collapsing parent autogroup removes its children', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace(parentAutogroupEAPSpans),
        traceMetadata
      );
      TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

      tree.root.forEachChild(c => {
        if (isParentAutogroupedNode(c)) {
          c.expand(true, tree);
        }
      });

      expect(tree.build().serialize()).toMatchSnapshot();

      tree.root.forEachChild(c => {
        if (isParentAutogroupedNode(c)) {
          c.expand(false, tree);
        }
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('removes collapsed parent autogroup', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace(parentAutogroupEAPSpans),
        traceMetadata
      );
      const snapshot = tree.build().serialize();

      // Add children autogroup
      TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);
      expect(tree.root.findChild(c => isParentAutogroupedNode(c))).not.toBeNull();

      // Remove it and assert that the tree is back to the original state
      TraceTree.RemoveDirectChildrenAutogroupNodes(tree.root);

      expect(tree.root.findChild(c => isParentAutogroupedNode(c))).toBeNull();
      expect(tree.build().serialize()).toEqual(snapshot);
      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });
  describe('sibling autogrouping', () => {
    it('groups spans with the same op and description', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace(siblingAutogroupEAPSpans),
        traceMetadata
      );

      TraceTree.AutogroupSiblingSpanNodes(tree.root, options);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('groups spans with the same op and name', () => {
      const EAPOrganization = OrganizationFixture();

      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            op: 'http.server',
            description: 'redis',
            name: 'redis',
            event_id: '0000',
            children: [
              makeEAPSpan({
                event_id: '0001',
                op: 'db',
                name: 'GET',
                start_timestamp: start,
                end_timestamp: start + 1,
                parent_span_id: '0000',
              }),
              makeEAPSpan({
                event_id: '0002',
                op: 'db',
                name: 'GET',
                start_timestamp: start,
                end_timestamp: start + 1,
                parent_span_id: '0000',
              }),
              makeEAPSpan({
                event_id: '0003',
                op: 'db',
                name: 'GET',
                start_timestamp: start,
                end_timestamp: start + 1,
                parent_span_id: '0000',
              }),
              makeEAPSpan({
                event_id: '0004',
                op: 'db',
                name: 'GET',
                start_timestamp: start,
                end_timestamp: start + 1,
                parent_span_id: '0000',
              }),
              makeEAPSpan({
                event_id: '0005',
                op: 'db',
                name: 'GET',
                start_timestamp: start,
                end_timestamp: start + 1,
                parent_span_id: '0000',
              }),
            ],
          }),
        ]),
        {
          ...traceMetadata,
          organization: EAPOrganization,
        }
      );

      TraceTree.AutogroupSiblingSpanNodes(tree.root, {
        organization: EAPOrganization,
      });
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('does not autogroup if count is less 5', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            op: 'http.server',
            description: 'redis',
            event_id: '0000',
            children: [
              makeEAPSpan({
                event_id: '0001',
                op: 'db',
                description: 'redis',
                start_timestamp: start,
                end_timestamp: start + 1,
                parent_span_id: '0000',
              }),
              makeEAPSpan({
                event_id: '0002',
                op: 'db',
                description: 'redis',
                start_timestamp: start,
                end_timestamp: start + 1,
                parent_span_id: '0000',
              }),
              makeEAPSpan({
                event_id: '0003',
                op: 'db',
                description: 'redis',
                start_timestamp: start,
                end_timestamp: start + 1,
                parent_span_id: '0000',
              }),
            ],
          }),
        ]),
        traceMetadata
      );

      TraceTree.AutogroupSiblingSpanNodes(tree.root, options);

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('does not autogroup gen_ai sibling spans', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'root',
            op: 'http.server',
            children: Array.from({length: 5}, (_, index) =>
              makeEAPSpan({
                event_id: `gen-ai-${index}`,
                op: 'gen_ai.chat',
                description: 'chat',
                parent_span_id: 'root',
                start_timestamp: start,
                end_timestamp: start + 1,
              })
            ),
          }),
        ]),
        traceMetadata
      );

      expect(TraceTree.AutogroupSiblingSpanNodes(tree.root, options)).toBe(0);
      expect(tree.root.findChild(isSiblingAutogroupedNode)).toBeNull();
    });

    it('expanding sibling autogroup renders its children', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace(siblingAutogroupEAPSpans),
        traceMetadata
      );

      TraceTree.AutogroupSiblingSpanNodes(tree.root, options);

      tree.root.forEachChild(c => {
        if (isSiblingAutogroupedNode(c)) {
          c.expand(true, tree);
        }
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('collapsing sibling autogroup removes its children', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace(siblingAutogroupEAPSpans),
        traceMetadata
      );

      TraceTree.AutogroupSiblingSpanNodes(tree.root, options);

      tree.root.forEachChild(c => {
        if (isSiblingAutogroupedNode(c)) {
          c.expand(true, tree);
        }
      });
      expect(tree.build().serialize()).toMatchSnapshot();
      tree.root.forEachChild(c => {
        if (isSiblingAutogroupedNode(c)) {
          c.expand(false, tree);
        }
      });
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('removes sibling autogroup', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace(siblingAutogroupEAPSpans),
        traceMetadata
      );

      const snapshot = tree.build().serialize();

      // Add sibling autogroup
      TraceTree.AutogroupSiblingSpanNodes(tree.root, options);
      expect(tree.root.findChild(c => isSiblingAutogroupedNode(c))).not.toBeNull();

      // Remove it and assert that the tree is back to the original state
      TraceTree.RemoveSiblingAutogroupNodes(tree.root);
      expect(tree.build().serialize()).toEqual(snapshot);
      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });
});
