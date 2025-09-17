import type {Theme} from '@emotion/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';

class TestNode extends BaseNode {
  get drawerTabsTitle(): string {
    return 'Tabs title';
  }

  get traceHeaderTitle(): {subtitle: string | undefined; title: string} {
    return {title: 'Trace Header Title', subtitle: this.description};
  }

  analyticsName(): string {
    return 'test';
  }

  makeBarColor(theme: Theme): string {
    return theme.blue300;
  }

  printNode(): string {
    return `Print Node(${this.id})`;
  }

  pathToNode(): TraceTree.NodePath[] {
    return [`test-${this.id}` as TraceTree.NodePath];
  }

  renderWaterfallRow<T extends TraceTree.Node = TraceTree.Node>(
    _props: TraceRowProps<T>
  ): React.ReactNode {
    return <div data-test-id="waterfall-row">Waterfall Row</div>;
  }

  renderDetails<T extends TraceTreeNode<TraceTree.NodeValue>>(
    _props: TraceTreeNodeDetailsProps<T>
  ): React.ReactNode {
    return <div data-test-id="node-details">Details</div>;
  }

  matchWithFreeText(key: string): boolean {
    return this.description?.includes(key) || this.op?.includes(key) || false;
  }
}

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

const createMockValue = (
  overrides: Partial<TraceTree.NodeValue> = {}
): TraceTree.NodeValue =>
  ({
    event_id: 'test-event-id',
    op: 'http.request',
    description: 'GET /api/users',
    project_slug: 'test-project',
    start_timestamp: 1000,
    end_timestamp: 2000,
    ...overrides,
  }) as TraceTree.NodeValue;

describe('BaseNode', () => {
  describe('constructor', () => {
    it('should initialize with basic properties', () => {
      const extra = createMockExtra();
      const value = createMockValue();
      const node = new TestNode(null, value, extra);

      expect(node.parent).toBeNull();
      expect(node.value).toBe(value);
      expect(node.extra).toBe(extra);
      expect(node.expanded).toBe(true);
      expect(node.canFetchChildren).toBe(false);
      expect(node.fetchStatus).toBe('idle');
      expect(node.hasFetchedChildren).toBe(false);
      expect(node.canAutogroup).toBe(false);
      expect(node.allowNoInstrumentationNodes).toBe(false);
      expect(node.children).toEqual([]);
      expect(node.errors).toBeInstanceOf(Set);
      expect(node.occurrences).toBeInstanceOf(Set);
      expect(node.profiles).toBeInstanceOf(Set);
    });

    it('should set parent relationship correctly', () => {
      const extra = createMockExtra();
      const parentValue = createMockValue();
      const childValue = createMockValue();

      const parent = new TestNode(null, parentValue, extra);
      const child = new TestNode(parent, childValue, extra);

      expect(child.parent).toBe(parent);
    });

    it('should initialize reparent_reason as null', () => {
      const extra = createMockExtra();
      const value = createMockValue();

      const node = new TestNode(null, value, extra);
      expect(node.reparent_reason).toBeNull();
    });
  });

  describe('space calculation', () => {
    it('should calculate space correctly with start and end timestamps', () => {
      const extra = createMockExtra();
      const value = createMockValue({
        event_id: 'test-id',
        start_timestamp: 1000,
        end_timestamp: 2000,
      });

      const node = new TestNode(null, value, extra);

      expect(node.space).toEqual([1000000, 1000000]); // Converted to milliseconds
    });

    it('should handle only end timestamp', () => {
      const extra = createMockExtra();
      const value = createMockValue({
        event_id: 'test-id',
        start_timestamp: undefined,
        end_timestamp: 1500,
      });

      const node = new TestNode(null, value, extra);

      expect(node.space).toEqual([1500000, 0]);
    });

    it('should handle only start timestamp', () => {
      const extra = createMockExtra();
      const value = createMockValue({
        event_id: 'test-id',
        start_timestamp: 1000,
        end_timestamp: undefined,
      });

      const node = new TestNode(null, value, extra);

      expect(node.space).toEqual([1000000, 0]);
    });

    it('should default to [0, 0] with no timestamps', () => {
      const extra = createMockExtra();
      const value = createMockValue({
        event_id: 'test-id',
        start_timestamp: undefined,
        end_timestamp: undefined,
      });

      const node = new TestNode(null, value, extra);

      expect(node.space).toEqual([0, 0]);
    });
  });

  describe('getter methods', () => {
    it('should return correct id from value', () => {
      const extra = createMockExtra();
      const value = createMockValue({event_id: 'test-event-id'});

      const node = new TestNode(null, value, extra);

      expect(node.id).toBe('test-event-id');
    });

    it('should return undefined for id if not present', () => {
      const extra = createMockExtra();
      const value = createMockValue({event_id: undefined});

      const node = new TestNode(null, value, extra);

      expect(node.id).toBeUndefined();
    });

    it('should return correct op from value', () => {
      const extra = createMockExtra();
      const value = createMockValue({op: 'http.request'});

      const node = new TestNode(null, value, extra);

      expect(node.op).toBe('http.request');
    });

    it('should return correct project slug from value', () => {
      const extra = createMockExtra();
      const value = createMockValue({project_slug: 'my-project'});

      const node = new TestNode(null, value, extra);

      expect(node.projectSlug).toBe('my-project');
    });

    it('should return correct description from value', () => {
      const extra = createMockExtra();
      const value = createMockValue({description: 'GET /api/users'});

      const node = new TestNode(null, value, extra);

      expect(node.description).toBe('GET /api/users');
    });

    it('should return correct start timestamp', () => {
      const extra = createMockExtra();
      const value = createMockValue({
        start_timestamp: 1000,
        end_timestamp: 2000,
      });

      const node = new TestNode(null, value, extra);

      expect(node.startTimestamp).toBe(1000);
    });

    it('should return correct end timestamp from value', () => {
      const extra = createMockExtra();
      const value = createMockValue({end_timestamp: 2000});

      const node = new TestNode(null, value, extra);

      expect(node.endTimestamp).toBe(2000);
    });

    it('should return correct SDK name from value', () => {
      const extra = createMockExtra();
      const value = createMockValue({sdk_name: 'sentry.javascript.react'});

      const node = new TestNode(null, value, extra);

      expect(node.sdkName).toBe('sentry.javascript.react');
    });
  });

  describe('error and occurrence handling', () => {
    it('should collect errors from value during construction', () => {
      const extra = createMockExtra();
      const errors = [
        {issue_id: 1, event_id: 'error-1'},
        {issue_id: 2, event_id: 'error-2'},
      ];
      const value = createMockValue({
        event_id: 'test-id',
        errors: errors as TraceTree.TraceError[],
      });

      const node = new TestNode(null, value, extra);

      expect(node.errors.size).toBe(2);
      expect(Array.from(node.errors)).toEqual(errors);
    });

    it('should collect occurrences from value during construction', () => {
      const extra = createMockExtra();
      const occurrences = [
        {issue_id: 1, event_id: 'occurrence-1'},
        {issue_id: 2, event_id: 'occurrence-2'},
      ];
      const value = createMockValue({
        event_id: 'test-id',
        occurrences: occurrences as TraceTree.EAPOccurrence[],
      });

      const node = new TestNode(null, value, extra);

      expect(node.occurrences.size).toBe(2);
      expect(Array.from(node.occurrences)).toEqual(occurrences);
    });

    it('should return unique error issues', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test-id'}), extra);

      // Add duplicate issue IDs
      node.errors.add({issue_id: 1, event_id: 'error-1'} as TraceTree.TraceErrorIssue);
      node.errors.add({
        issue_id: 1,
        event_id: 'error-1-duplicate',
      } as TraceTree.TraceErrorIssue);
      node.errors.add({issue_id: 2, event_id: 'error-2'} as TraceTree.TraceErrorIssue);

      const uniqueErrors = node.uniqueErrorIssues;
      expect(uniqueErrors).toHaveLength(2);
      expect(uniqueErrors.map(e => e.issue_id)).toEqual([1, 2]);
    });

    it('should return unique occurrence issues', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test-id'}), extra);

      // Add duplicate issue IDs
      node.occurrences.add({
        issue_id: 1,
        event_id: 'occurrence-1',
      } as TraceTree.TraceOccurrence);
      node.occurrences.add({
        issue_id: 1,
        event_id: 'occurrence-1-duplicate',
      } as TraceTree.TraceOccurrence);
      node.occurrences.add({
        issue_id: 2,
        event_id: 'occurrence-2',
      } as TraceTree.TraceOccurrence);

      const uniqueOccurrences = node.uniqueOccurrenceIssues;
      expect(uniqueOccurrences).toHaveLength(2);
      expect(uniqueOccurrences.map(o => o.issue_id)).toEqual([1, 2]);
    });

    it('should combine unique issues from errors and occurrences', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test-id'}), extra);

      node.errors.add({issue_id: 1, event_id: 'error-1'} as TraceTree.TraceErrorIssue);
      node.occurrences.add({
        issue_id: 2,
        event_id: 'occurrence-2',
      } as TraceTree.TraceOccurrence);

      const uniqueIssues = node.uniqueIssues;
      expect(uniqueIssues).toHaveLength(2);
    });

    it('should correctly report hasIssues', () => {
      const extra = createMockExtra();
      const nodeWithoutIssues = new TestNode(
        null,
        createMockValue({event_id: 'test-id'}),
        extra
      );
      expect(nodeWithoutIssues.hasIssues).toBe(false);

      const nodeWithErrors = new TestNode(
        null,
        createMockValue({event_id: 'test-id'}),
        extra
      );
      nodeWithErrors.errors.add({
        issue_id: 1,
        event_id: 'error-1',
      } as TraceTree.TraceErrorIssue);
      expect(nodeWithErrors.hasIssues).toBe(true);

      const nodeWithOccurrences = new TestNode(
        null,
        createMockValue({event_id: 'test-id'}),
        extra
      );
      nodeWithOccurrences.occurrences.add({
        issue_id: 1,
        event_id: 'occurrence-1',
      } as TraceTree.TraceOccurrence);
      expect(nodeWithOccurrences.hasIssues).toBe(true);
    });
  });

  describe('profile handling', () => {
    it('should collect profile from profile_id during construction', () => {
      const extra = createMockExtra();
      const value = createMockValue({
        event_id: 'test-id',
        profile_id: 'profile-123',
      });

      const node = new TestNode(null, value, extra);

      expect(node.profiles.size).toBe(1);
      expect(Array.from(node.profiles)).toEqual([{profile_id: 'profile-123'}]);
    });

    it('should collect profile from profiler_id during construction', () => {
      const extra = createMockExtra();
      const value = createMockValue({
        event_id: 'test-id',
        profiler_id: 'profiler-456',
      });

      const node = new TestNode(null, value, extra);

      expect(node.profiles.size).toBe(1);
      expect(Array.from(node.profiles)).toEqual([{profiler_id: 'profiler-456'}]);
    });

    it('should ignore empty profile IDs', () => {
      const extra = createMockExtra();
      const value = createMockValue({
        event_id: 'test-id',
        profile_id: '',
        profiler_id: '   ',
      });

      const node = new TestNode(null, value, extra);

      expect(node.profiles.size).toBe(0);
    });

    it('should collect both profile_id and profiler_id', () => {
      const extra = createMockExtra();
      const value = createMockValue({
        event_id: 'test-id',
        profile_id: 'profile-123',
        profiler_id: 'profiler-456',
      });

      const node = new TestNode(null, value, extra);

      expect(node.profiles.size).toBe(2);
      const profilesArray = Array.from(node.profiles);
      expect(profilesArray).toContainEqual({profile_id: 'profile-123'});
      expect(profilesArray).toContainEqual({profiler_id: 'profiler-456'});
    });
  });

  describe('children management', () => {
    it('should return direct children', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
      const child2 = new TestNode(parent, createMockValue({event_id: 'child2'}), extra);

      parent.children = [child1, child2];

      expect(parent.directChildren).toEqual([child1, child2]);
    });

    it('should return visible children when expanded', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
      const child2 = new TestNode(parent, createMockValue({event_id: 'child2'}), extra);

      parent.children = [child1, child2];
      parent.expanded = true;

      const visibleChildren = parent.visibleChildren;
      expect(visibleChildren).toHaveLength(2);
      expect(visibleChildren).toContain(child1);
      expect(visibleChildren).toContain(child2);
    });

    it('should return empty array for visible children when collapsed', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
      const child2 = new TestNode(parent, createMockValue({event_id: 'child2'}), extra);

      parent.children = [child1, child2];
      parent.expanded = false;

      expect(parent.visibleChildren).toEqual([]);
    });
  });

  describe('matching functionality', () => {
    it('should match by node ID', () => {
      const extra = createMockExtra();
      const node = new TestNode(
        null,
        createMockValue({event_id: 'test-event-id'}),
        extra
      );

      expect(node.matchById('test-event-id')).toBe(true);
      expect(node.matchById('different-id')).toBe(false);
    });

    it('should match by error event ID', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'node-id'}), extra);
      node.errors.add({
        issue_id: 1,
        event_id: 'error-event-id',
      } as TraceTree.TraceErrorIssue);

      expect(node.matchById('error-event-id')).toBe(true);
      expect(node.matchById('different-id')).toBe(false);
    });

    it('should match by occurrence event ID', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'node-id'}), extra);
      node.occurrences.add({
        issue_id: 1,
        event_id: 'occurrence-event-id',
      } as TraceTree.TraceOccurrence);

      expect(node.matchById('occurrence-event-id')).toBe(true);
      expect(node.matchById('different-id')).toBe(false);
    });

    it('should match with free text using description', () => {
      const extra = createMockExtra();
      const node = new TestNode(
        null,
        createMockValue({
          event_id: 'test-id',
          description: 'GET /api/users',
          op: 'http.request',
        }),
        extra
      );

      expect(node.matchWithFreeText('api')).toBe(true);
      expect(node.matchWithFreeText('users')).toBe(true);
      expect(node.matchWithFreeText('http')).toBe(true);
      expect(node.matchWithFreeText('request')).toBe(true);
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });
  });

  describe('tree operations', () => {
    it('should invalidate depth and connectors', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test-id'}), extra);

      node.depth = 5;
      node.connectors = [1, 2, 3];

      node.invalidate();

      expect(node.depth).toBeUndefined();
      expect(node.connectors).toBeUndefined();
    });

    it('should generate path to node', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: '1-event-id'}), extra);

      expect(node.pathToNode()).toEqual(['test-1-event-id']);
    });

    it('should return promise for fetchChildren', async () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test-id'}), extra);

      const result = await node.fetchChildren(false, {} as TraceTree, {
        api: {} as any,
        preferences: {} as any,
      });

      expect(result).toBeNull();
    });
  });

  describe('abstract method implementations', () => {
    it('should implement required abstract methods', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test-id'}), extra);

      expect(node.drawerTabsTitle).toBe('Tabs title');
      expect(node.traceHeaderTitle).toEqual({
        title: 'Trace Header Title',
        subtitle: 'GET /api/users',
      });
      expect(node.makeBarColor({blue300: '#blue'} as any)).toBe('#blue');
      expect(node.printNode()).toBe('Print Node(test-id)');
      expect(node.analyticsName()).toBe('test');

      render(node.renderWaterfallRow({} as any) as React.ReactElement);
      expect(screen.getByTestId('waterfall-row')).toBeInTheDocument();

      render(node.renderDetails({} as any) as React.ReactElement);
      expect(screen.getByTestId('node-details')).toBeInTheDocument();
    });
  });

  describe('tree traversal methods', () => {
    describe('getNextTraversalNodes', () => {
      it('should return direct children', () => {
        const extra = createMockExtra();
        const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
        const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
        const child2 = new TestNode(parent, createMockValue({event_id: 'child2'}), extra);

        parent.children = [child1, child2];

        const traversalNodes = parent.getNextTraversalNodes();
        expect(traversalNodes).toHaveLength(2);
        expect(traversalNodes).toContain(child1);
        expect(traversalNodes).toContain(child2);
        expect(traversalNodes).toBe(parent.children); // Should return the same array reference
      });

      it('should return empty array when no children', () => {
        const extra = createMockExtra();
        const node = new TestNode(null, createMockValue({event_id: 'leaf'}), extra);

        expect(node.getNextTraversalNodes()).toEqual([]);
        expect(node.getNextTraversalNodes()).toHaveLength(0);
      });
    });

    describe('findChild', () => {
      it('should find direct child matching predicate', () => {
        const extra = createMockExtra();
        const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
        const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
        const child2 = new TestNode(parent, createMockValue({event_id: 'target'}), extra);

        parent.children = [child1, child2];

        const found = parent.findChild(node => node.id === 'target');
        expect(found).toBe(child2);
      });

      it('should find self when matching predicate', () => {
        const extra = createMockExtra();
        const node = new TestNode(null, createMockValue({event_id: 'target'}), extra);

        const found = node.findChild(n => n.id === 'target');
        expect(found).toBe(node);
      });

      it('should find deeply nested child', () => {
        const extra = createMockExtra();
        const root = new TestNode(null, createMockValue({event_id: 'root'}), extra);
        const level1 = new TestNode(root, createMockValue({event_id: 'level1'}), extra);
        const level2 = new TestNode(level1, createMockValue({event_id: 'level2'}), extra);
        const target = new TestNode(level2, createMockValue({event_id: 'target'}), extra);

        root.children = [level1];
        level1.children = [level2];
        level2.children = [target];

        const found = root.findChild(node => node.id === 'target');
        expect(found).toBe(target);
      });

      it('should return null when no match found', () => {
        const extra = createMockExtra();
        const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
        const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
        const child2 = new TestNode(parent, createMockValue({event_id: 'child2'}), extra);

        parent.children = [child1, child2];

        const found = parent.findChild(node => node.id === 'nonexistent');
        expect(found).toBeNull();
      });

      it('should find first matching child when multiple matches exist', () => {
        const extra = createMockExtra();
        const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
        const child1 = new TestNode(
          parent,
          createMockValue({event_id: 'child1', op: 'http.request'}),
          extra
        );
        const child2 = new TestNode(
          parent,
          createMockValue({event_id: 'child2', op: 'http.request'}),
          extra
        );

        parent.children = [child1, child2];

        const found = parent.findChild(node => node.op === 'http.request');
        expect(found).toBe(parent); // Should find self first since traversal starts with self
      });

      it('should handle complex tree with multiple branches', () => {
        const extra = createMockExtra();
        const root = new TestNode(null, createMockValue({event_id: 'root'}), extra);
        const branch1 = new TestNode(root, createMockValue({event_id: 'branch1'}), extra);
        const branch2 = new TestNode(root, createMockValue({event_id: 'branch2'}), extra);
        const leaf1 = new TestNode(branch1, createMockValue({event_id: 'leaf1'}), extra);
        const target = new TestNode(
          branch2,
          createMockValue({event_id: 'target'}),
          extra
        );

        root.children = [branch1, branch2];
        branch1.children = [leaf1];
        branch2.children = [target];

        const found = root.findChild(node => node.id === 'target');
        expect(found).toBe(target);
      });
    });

    describe('findAllChildren', () => {
      it('should find all matching children', () => {
        const extra = createMockExtra();
        const parent = new TestNode(
          null,
          createMockValue({event_id: 'parent', op: 'transaction'}),
          extra
        );
        const child1 = new TestNode(
          parent,
          createMockValue({event_id: 'child1', op: 'http.request'}),
          extra
        );
        const child2 = new TestNode(
          parent,
          createMockValue({event_id: 'child2', op: 'db.query'}),
          extra
        );
        const child3 = new TestNode(
          parent,
          createMockValue({event_id: 'child3', op: 'http.request'}),
          extra
        );

        parent.children = [child1, child2, child3];

        const found = parent.findAllChildren(node => node.op === 'http.request');
        expect(found).toHaveLength(2);
        expect(found).toContain(child1);
        expect(found).toContain(child3);
        expect(found).not.toContain(child2);
      });

      it('should include self when matching predicate', () => {
        const extra = createMockExtra();
        const node = new TestNode(
          null,
          createMockValue({event_id: 'target', op: 'http.request'}),
          extra
        );
        const child = new TestNode(
          node,
          createMockValue({event_id: 'child', op: 'db.query'}),
          extra
        );

        node.children = [child];

        const found = node.findAllChildren(n => n.op === 'http.request');
        expect(found).toHaveLength(1);
        expect(found).toContain(node);
      });

      it('should find all nodes in complex tree structure', () => {
        const extra = createMockExtra();
        const root = new TestNode(
          null,
          createMockValue({event_id: 'root', op: 'transaction'}),
          extra
        );
        const level1a = new TestNode(
          root,
          createMockValue({event_id: 'level1a', op: 'http.request'}),
          extra
        );
        const level1b = new TestNode(
          root,
          createMockValue({event_id: 'level1b', op: 'db.query'}),
          extra
        );
        const level2a = new TestNode(
          level1a,
          createMockValue({event_id: 'level2a', op: 'http.request'}),
          extra
        );
        const level2b = new TestNode(
          level1b,
          createMockValue({event_id: 'level2b', op: 'http.request'}),
          extra
        );

        root.children = [level1a, level1b];
        level1a.children = [level2a];
        level1b.children = [level2b];

        const found = root.findAllChildren(node => node.op === 'http.request');
        expect(found).toHaveLength(3);
        expect(found).toContain(level1a);
        expect(found).toContain(level2a);
        expect(found).toContain(level2b);
      });

      it('should return empty array when no matches found', () => {
        const extra = createMockExtra();
        const parent = new TestNode(
          null,
          createMockValue({event_id: 'parent', op: 'transaction'}),
          extra
        );
        const child = new TestNode(
          parent,
          createMockValue({event_id: 'child', op: 'db.query'}),
          extra
        );

        parent.children = [child];

        const found = parent.findAllChildren(node => node.op === 'nonexistent');
        expect(found).toHaveLength(0);
      });
    });

    describe('forEachChild', () => {
      it('should visit all nodes including self', () => {
        const extra = createMockExtra();
        const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
        const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
        const child2 = new TestNode(parent, createMockValue({event_id: 'child2'}), extra);

        parent.children = [child1, child2];

        const visitedIds: string[] = [];
        parent.forEachChild(node => {
          if (node.id) visitedIds.push(node.id);
        });

        expect(visitedIds).toHaveLength(3);
        expect(visitedIds).toContain('parent');
        expect(visitedIds).toContain('child1');
        expect(visitedIds).toContain('child2');
      });

      it('should visit nodes in depth-first order', () => {
        const extra = createMockExtra();
        const root = new TestNode(null, createMockValue({event_id: 'root'}), extra);
        const level1 = new TestNode(root, createMockValue({event_id: 'level1'}), extra);
        const level2 = new TestNode(level1, createMockValue({event_id: 'level2'}), extra);
        const sibling = new TestNode(root, createMockValue({event_id: 'sibling'}), extra);

        root.children = [level1, sibling];
        level1.children = [level2];

        const visitedIds: string[] = [];
        root.forEachChild(node => {
          if (node.id) visitedIds.push(node.id);
        });

        expect(visitedIds).toEqual(['root', 'sibling', 'level1', 'level2']);
      });

      it('should handle callback that modifies state', () => {
        const extra = createMockExtra();
        const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
        const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
        const child2 = new TestNode(parent, createMockValue({event_id: 'child2'}), extra);

        parent.children = [child1, child2];

        let visitCount = 0;
        const nodeDepths: number[] = [];

        parent.forEachChild(node => {
          visitCount++;
          // Simulate setting depth based on visit order
          node.depth = visitCount;
          nodeDepths.push(node.depth);
        });

        expect(visitCount).toBe(3);
        expect(nodeDepths).toEqual([1, 2, 3]);
        expect(parent.depth).toBe(1);
        expect(child2.depth).toBe(2);
        expect(child1.depth).toBe(3);
      });

      it('should work with empty tree', () => {
        const extra = createMockExtra();
        const node = new TestNode(null, createMockValue({event_id: 'lonely'}), extra);

        let visitCount = 0;
        node.forEachChild(() => {
          visitCount++;
        });

        expect(visitCount).toBe(1); // Should visit self
      });
    });

    describe('findParent', () => {
      it('should find direct parent matching predicate', () => {
        const extra = createMockExtra();
        const parent = new TestNode(
          null,
          createMockValue({event_id: 'parent', op: 'transaction'}),
          extra
        );
        const child = new TestNode(
          parent,
          createMockValue({event_id: 'child', op: 'http.request'}),
          extra
        );

        const found = child.findParent(node => node.op === 'transaction');
        expect(found).toBe(parent);
      });

      it('should find deeply nested parent', () => {
        const extra = createMockExtra();
        const grandparent = new TestNode(
          null,
          createMockValue({event_id: 'grandparent', op: 'transaction'}),
          extra
        );
        const parent = new TestNode(
          grandparent,
          createMockValue({event_id: 'parent', op: 'http.request'}),
          extra
        );
        const child = new TestNode(
          parent,
          createMockValue({event_id: 'child', op: 'db.query'}),
          extra
        );

        const found = child.findParent(node => node.op === 'transaction');
        expect(found).toBe(grandparent);
      });

      it('should return null when no parent matches', () => {
        const extra = createMockExtra();
        const parent = new TestNode(
          null,
          createMockValue({event_id: 'parent', op: 'transaction'}),
          extra
        );
        const child = new TestNode(
          parent,
          createMockValue({event_id: 'child', op: 'http.request'}),
          extra
        );

        const found = child.findParent(node => node.op === 'nonexistent');
        expect(found).toBeNull();
      });

      it('should return null when node has no parent', () => {
        const extra = createMockExtra();
        const root = new TestNode(
          null,
          createMockValue({event_id: 'root', op: 'transaction'}),
          extra
        );

        const found = root.findParent(node => node.op === 'transaction');
        expect(found).toBeNull();
      });

      it('should find first matching parent when multiple matches exist', () => {
        const extra = createMockExtra();
        const root = new TestNode(
          null,
          createMockValue({event_id: 'root', op: 'transaction'}),
          extra
        );
        const level1 = new TestNode(
          root,
          createMockValue({event_id: 'level1', op: 'transaction'}),
          extra
        );
        const level2 = new TestNode(
          level1,
          createMockValue({event_id: 'level2', op: 'http.request'}),
          extra
        );

        const found = level2.findParent(node => node.op === 'transaction');
        expect(found).toBe(level1); // Should find the closest matching parent
      });

      it('should work with complex predicate matching multiple properties', () => {
        const extra = createMockExtra();
        const root = new TestNode(
          null,
          createMockValue({
            event_id: 'root',
            op: 'transaction',
            project_slug: 'frontend',
          }),
          extra
        );
        const parent = new TestNode(
          root,
          createMockValue({
            event_id: 'parent',
            op: 'http.request',
            project_slug: 'backend',
          }),
          extra
        );
        const child = new TestNode(
          parent,
          createMockValue({
            event_id: 'child',
            op: 'db.query',
            project_slug: 'backend',
          }),
          extra
        );

        // Find parent with specific op and project
        const found = child.findParent(
          node => node.op === 'transaction' && node.projectSlug === 'frontend'
        );
        expect(found).toBe(root);
      });

      it('should work with predicate that matches node properties', () => {
        const extra = createMockExtra();
        const parent = new TestNode(
          null,
          createMockValue({event_id: 'parent-id'}),
          extra
        );
        // Add error to parent
        parent.errors.add({
          issue_id: 1,
          event_id: 'error-1',
        } as TraceTree.TraceErrorIssue);

        const child = new TestNode(
          parent,
          createMockValue({event_id: 'child-id'}),
          extra
        );

        const found = child.findParent(node => node.hasIssues);
        expect(found).toBe(parent);
      });

      it('should handle predicate that checks for specific ID', () => {
        const extra = createMockExtra();
        const root = new TestNode(null, createMockValue({event_id: 'root-id'}), extra);
        const parent = new TestNode(
          root,
          createMockValue({event_id: 'parent-id'}),
          extra
        );
        const child = new TestNode(
          parent,
          createMockValue({event_id: 'child-id'}),
          extra
        );

        const found = child.findParent(node => node.id === 'root-id');
        expect(found).toBe(root);
      });

      it('should traverse entire parent chain', () => {
        const extra = createMockExtra();

        // Create a deep hierarchy
        let current = new TestNode(
          null,
          createMockValue({event_id: 'level-0', op: 'root'}),
          extra
        );
        const root = current;

        for (let i = 1; i <= 5; i++) {
          const newNode = new TestNode(
            current,
            createMockValue({
              event_id: `level-${i}`,
              op: i === 3 ? 'special' : 'normal',
            }),
            extra
          );
          current = newNode;
        }

        // From the deepest node, find the node with op 'special'
        const found = current.findParent(node => node.op === 'special');
        expect(found?.id).toBe('level-3');

        // From the deepest node, find the root
        const foundRoot = current.findParent(node => node.op === 'root');
        expect(foundRoot).toBe(root);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined values gracefully', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, null, extra);

      expect(node.id).toBeUndefined();
      expect(node.op).toBeUndefined();
      expect(node.projectSlug).toBeUndefined();
      expect(node.description).toBeUndefined();
      expect(node.endTimestamp).toBeUndefined();
      expect(node.sdkName).toBeUndefined();
      expect(node.space).toEqual([0, 0]);
    });

    it('should handle empty arrays for errors and occurrences', () => {
      const extra = createMockExtra();
      const value = createMockValue({
        event_id: 'test-id',
        errors: [],
        occurrences: [],
      });

      const node = new TestNode(null, value, extra);

      expect(node.errors.size).toBe(0);
      expect(node.occurrences.size).toBe(0);
      expect(node.hasIssues).toBe(false);
    });

    it('should handle non-array errors and occurrences', () => {
      const extra = createMockExtra();
      const value = createMockValue({
        event_id: 'test-id',
        errors: 'not-an-array' as any,
        occurrences: 'not-an-array' as any,
      });

      const node = new TestNode(null, value, extra);

      expect(node.errors.size).toBe(0);
      expect(node.occurrences.size).toBe(0);
    });
  });
});
