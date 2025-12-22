import type {Theme} from '@emotion/react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  makeEAPOccurrence,
  makeTraceError,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';

class TestNode extends BaseNode {
  get id(): string {
    return (this.value as any).event_id;
  }

  get type(): TraceTree.NodeType {
    return 'test' as TraceTree.NodeType;
  }

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
    return theme.colors.blue400;
  }

  printNode(): string {
    return `Print Node(${this.id})`;
  }

  matchByPath(path: TraceTree.NodePath): boolean {
    const [type, id] = path.split('-');
    if (type !== 'test' || !id) {
      return false;
    }

    return this.matchById(id);
  }

  renderWaterfallRow<T extends TraceTree.Node = TraceTree.Node>(
    _props: TraceRowProps<T>
  ): React.ReactNode {
    return <div data-test-id="waterfall-row">Waterfall Row</div>;
  }

  renderDetails<T extends BaseNode>(
    _props: TraceTreeNodeDetailsProps<T>
  ): React.ReactNode {
    return <div data-test-id="node-details">Details</div>;
  }

  matchWithFreeText(key: string): boolean {
    return this.description?.includes(key) || this.op?.includes(key) || false;
  }

  resolveValueFromSearchKey(_key: string): any | null {
    return null;
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
      expect(node.isEAPEvent).toBe(false);
      expect(node.canShowDetails).toBe(true);
      expect(node.searchPriority).toBe(0);
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
    it('should return correct project id from value', () => {
      const extra = createMockExtra();
      const value = createMockValue({project_id: 123});

      const node = new TestNode(null, value, extra);

      expect(node.projectId).toBe(123);
    });

    it('should return correct id from value', () => {
      const extra = createMockExtra();
      const value = createMockValue({event_id: 'test-event-id'});

      const node = new TestNode(null, value, extra);

      expect(node.id).toBe('test-event-id');
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
        makeTraceError({
          issue_id: 1,
          event_id: 'error-1',
        }),
        makeTraceError({
          issue_id: 2,
          event_id: 'error-2',
        }),
      ];
      const value = createMockValue({
        event_id: 'test-id',
        errors,
      });

      const node = new TestNode(null, value, extra);

      expect(node.errors.size).toBe(2);
      expect(Array.from(node.errors)).toEqual(errors);
    });

    it('should collect occurrences from value during construction', () => {
      const extra = createMockExtra();
      const occurrences = [
        makeEAPOccurrence({issue_id: 1, event_id: 'occurrence-1'}),
        makeEAPOccurrence({issue_id: 2, event_id: 'occurrence-2'}),
      ];
      const value = createMockValue({
        event_id: 'test-id',
        occurrences,
      });

      const node = new TestNode(null, value, extra);

      expect(node.occurrences.size).toBe(2);
      expect(Array.from(node.occurrences)).toEqual(occurrences);
    });

    it('should return unique error issues', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test-id'}), extra);

      // Add duplicate issue IDs
      node.errors.add(makeTraceError({issue_id: 1, event_id: 'error-1'}));
      node.errors.add(
        makeTraceError({
          issue_id: 1,
          event_id: 'error-1-duplicate',
        })
      );
      node.errors.add(makeTraceError({issue_id: 2, event_id: 'error-2'}));

      const uniqueErrors = node.uniqueErrorIssues;
      expect(uniqueErrors).toHaveLength(2);
      expect(uniqueErrors.map(e => e.issue_id)).toEqual([1, 2]);
    });

    it('should return unique occurrence issues', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test-id'}), extra);

      // Add duplicate issue IDs
      node.occurrences.add(
        makeEAPOccurrence({
          issue_id: 1,
          event_id: 'occurrence-1',
        })
      );
      node.occurrences.add(
        makeEAPOccurrence({
          issue_id: 1,
          event_id: 'occurrence-1-duplicate',
        })
      );
      node.occurrences.add(
        makeEAPOccurrence({
          issue_id: 2,
          event_id: 'occurrence-2',
        })
      );

      const uniqueOccurrences = node.uniqueOccurrenceIssues;
      expect(uniqueOccurrences).toHaveLength(2);
      expect(uniqueOccurrences.map(o => o.issue_id)).toEqual([1, 2]);
    });

    it('should combine unique issues from errors and occurrences', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test-id'}), extra);

      node.errors.add(makeTraceError({issue_id: 1, event_id: 'error-1'}));
      node.occurrences.add(
        makeEAPOccurrence({
          issue_id: 2,
          event_id: 'occurrence-2',
        })
      );

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
      nodeWithErrors.errors.add(
        makeTraceError({
          issue_id: 1,
          event_id: 'error-1',
        })
      );
      expect(nodeWithErrors.hasIssues).toBe(true);

      const nodeWithOccurrences = new TestNode(
        null,
        createMockValue({event_id: 'test-id'}),
        extra
      );
      nodeWithOccurrences.occurrences.add(
        makeEAPOccurrence({
          issue_id: 1,
          event_id: 'occurrence-1',
        })
      );
      expect(nodeWithOccurrences.hasIssues).toBe(true);
    });

    it('should return correct maxIssueSeverity based on error levels', () => {
      const extra = createMockExtra();

      // Node with no errors should return 'default'
      const nodeWithoutErrors = new TestNode(
        null,
        createMockValue({event_id: 'test-id'}),
        extra
      );
      expect(nodeWithoutErrors.maxIssueSeverity).toBe('default');

      // Node with error level should return 'error'
      const nodeWithError = new TestNode(
        null,
        createMockValue({event_id: 'test-id'}),
        extra
      );
      nodeWithError.errors.add(
        makeTraceError({
          issue_id: 1,
          event_id: 'error-1',
          level: 'error',
        })
      );
      expect(nodeWithError.maxIssueSeverity).toBe('error');

      // Node with fatal level should return 'fatal'
      const nodeWithFatal = new TestNode(
        null,
        createMockValue({event_id: 'test-id'}),
        extra
      );
      nodeWithFatal.errors.add(
        makeTraceError({
          issue_id: 1,
          event_id: 'fatal-1',
          level: 'fatal',
        })
      );
      expect(nodeWithFatal.maxIssueSeverity).toBe('fatal');

      // Node with warning level should return 'default' (warning not prioritized)
      const nodeWithWarning = new TestNode(
        null,
        createMockValue({event_id: 'test-id'}),
        extra
      );
      nodeWithWarning.errors.add(
        makeTraceError({
          issue_id: 1,
          event_id: 'warning-1',
          level: 'warning',
        })
      );
      expect(nodeWithWarning.maxIssueSeverity).toBe('default');

      // Node with mixed levels should prioritize error/fatal
      const nodeWithMixed = new TestNode(
        null,
        createMockValue({event_id: 'test-id'}),
        extra
      );
      nodeWithMixed.errors.add(
        makeTraceError({
          issue_id: 1,
          event_id: 'warning-1',
          level: 'warning',
        })
      );
      nodeWithMixed.errors.add(
        makeTraceError({
          issue_id: 2,
          event_id: 'error-1',
          level: 'error',
        })
      );
      expect(nodeWithMixed.maxIssueSeverity).toBe('error');
    });

    it('should cache maxIssueSeverity result', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test-id'}), extra);

      node.errors.add(
        makeTraceError({
          issue_id: 1,
          event_id: 'error-1',
          level: 'fatal',
        })
      );

      // First call should compute and cache the result
      const firstCall = node.maxIssueSeverity;
      expect(firstCall).toBe('fatal');

      // Second call should return cached result
      const secondCall = node.maxIssueSeverity;
      expect(secondCall).toBe('fatal');
      expect(secondCall).toBe(firstCall); // Should be the same reference
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

      expect(node.profileId).toBe('profile-123');
    });

    it('should collect profile from profiler_id during construction', () => {
      const extra = createMockExtra();
      const value = createMockValue({
        event_id: 'test-id',
        profiler_id: 'profiler-456',
      });

      const node = new TestNode(null, value, extra);
      expect(node.profilerId).toBe('profiler-456');
    });

    it('should ignore empty profile IDs', () => {
      const extra = createMockExtra();
      const value = createMockValue({
        event_id: 'test-id',
        profile_id: '',
      });

      const node = new TestNode(null, value, extra);

      expect(node.profileId).toBeUndefined();
    });

    it('should collect both profile_id and profiler_id', () => {
      const extra = createMockExtra();
      const value = createMockValue({
        event_id: 'test-id',
        profile_id: 'profile-123',
        profiler_id: 'profiler-456',
      });

      const node = new TestNode(null, value, extra);

      expect(node.profileId).toBe('profile-123');
      expect(node.profilerId).toBe('profiler-456');
    });
  });

  describe('children management', () => {
    it('should return direct children', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
      const child2 = new TestNode(parent, createMockValue({event_id: 'child2'}), extra);

      parent.children = [child1, child2];

      expect(parent.directVisibleChildren).toEqual([child1, child2]);
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
    it('should match by path', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'eventId'}), extra);

      expect(node.matchByPath('test-eventId' as TraceTree.NodePath)).toBe(true);
      expect(node.matchByPath('span-eventId')).toBe(false);
    });

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
      node.errors.add(
        makeTraceError({
          issue_id: 1,
          event_id: 'error-event-id',
        })
      );

      expect(node.matchById('error-event-id')).toBe(true);
      expect(node.matchById('different-id')).toBe(false);
    });

    it('should match by occurrence event ID', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'node-id'}), extra);
      node.occurrences.add(
        makeEAPOccurrence({
          issue_id: 1,
          event_id: 'occurrence-event-id',
        })
      );

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

    it('should generate path to node with canFetchChildren=true parent', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: '1-event-id'}), extra);
      const parent = new TestNode(null, createMockValue({event_id: '2-event-id'}), extra);

      node.parent = parent;
      parent.canFetchChildren = true;

      expect(node.path).toBe('test-1-event-id');
      expect(node.pathToNode()).toEqual(['test-1-event-id', 'test-2-event-id']);
    });

    it('should return promise for fetchChildren', async () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test-id'}), extra);

      const result = await node.fetchChildren(false, {} as TraceTree, {
        api: {} as any,
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
      expect(node.makeBarColor(ThemeFixture())).toEqual(ThemeFixture().blue300);
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
      it('should visit all nodes', () => {
        const extra = createMockExtra();
        const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
        const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
        const child2 = new TestNode(parent, createMockValue({event_id: 'child2'}), extra);

        parent.children = [child1, child2];

        const visitedIds: string[] = [];
        parent.forEachChild(node => {
          if (node.id) visitedIds.push(node.id);
        });

        expect(visitedIds).toHaveLength(2);
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

        expect(visitedIds).toEqual(['sibling', 'level1', 'level2']);
      });

      it('should handle callback that modifies state', () => {
        const extra = createMockExtra();
        const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
        const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
        const child2 = new TestNode(parent, createMockValue({event_id: 'child2'}), extra);

        parent.children = [child1, child2];
        child1.parent = parent;
        child2.parent = parent;

        let visitCount = 0;
        const nodeDepths: number[] = [];

        parent.forEachChild(node => {
          visitCount++;
          // Simulate setting depth based on visit order
          node.depth = visitCount;
          nodeDepths.push(node.depth);
        });

        expect(visitCount).toBe(2);
        expect(nodeDepths).toEqual([1, 2]);
        expect(parent.depth).toBeUndefined();
        expect(child2.depth).toBe(1);
        expect(child1.depth).toBe(2);
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
        parent.errors.add(
          makeTraceError({
            issue_id: 1,
            event_id: 'error-1',
          })
        );

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

  describe('isLastChild', () => {
    it('should return false when node has no parent', () => {
      const extra = createMockExtra();
      const root = new TestNode(null, createMockValue({event_id: 'root'}), extra);

      expect(root.isLastChild()).toBe(false);
    });

    it('should return true when node is the last visible child', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
      const child2 = new TestNode(parent, createMockValue({event_id: 'child2'}), extra);
      const lastChild = new TestNode(parent, createMockValue({event_id: 'last'}), extra);

      parent.children = [child1, child2, lastChild];
      parent.expanded = true;

      expect(lastChild.isLastChild()).toBe(true);
      expect(child1.isLastChild()).toBe(false);
      expect(child2.isLastChild()).toBe(false);
    });

    it('should return false when node is not the last visible child', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
      const child2 = new TestNode(parent, createMockValue({event_id: 'child2'}), extra);

      parent.children = [child1, child2];
      parent.expanded = true;

      expect(child1.isLastChild()).toBe(false);
      expect(child2.isLastChild()).toBe(true);
    });
  });

  describe('isRootNodeChild', () => {
    it('should return true when node is a child of the root node', () => {
      const extra = createMockExtra();
      const root = new TestNode(null, null, extra);
      const child = new TestNode(root, createMockValue({event_id: 'child'}), extra);
      child.parent = root;

      expect(child.isRootNodeChild()).toBe(true);
    });

    it('should return false when node is not a child of the root node', () => {
      const extra = createMockExtra();
      const root = new TestNode(null, createMockValue({event_id: 'root'}), extra);
      const child = new TestNode(root, createMockValue({event_id: 'child'}), extra);
      child.parent = root;

      expect(child.isRootNodeChild()).toBe(false);
    });
  });

  describe('hasVisibleChildren', () => {
    it('should return false when node has no children', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'leaf'}), extra);

      expect(node.hasVisibleChildren()).toBe(false);
    });

    it('should return false when node is collapsed', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      const child = new TestNode(parent, createMockValue({event_id: 'child'}), extra);

      parent.children = [child];
      parent.expanded = false;

      expect(parent.hasVisibleChildren()).toBe(false);
    });

    it('should return true when node is expanded and has children', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      const child = new TestNode(parent, createMockValue({event_id: 'child'}), extra);

      parent.children = [child];
      parent.expanded = true;

      expect(parent.hasVisibleChildren()).toBe(true);
    });

    it('should return true when node has nested visible children', () => {
      const extra = createMockExtra();
      const root = new TestNode(null, createMockValue({event_id: 'root'}), extra);
      const parent = new TestNode(root, createMockValue({event_id: 'parent'}), extra);
      const child = new TestNode(parent, createMockValue({event_id: 'child'}), extra);

      root.children = [parent];
      parent.children = [child];
      root.expanded = true;
      parent.expanded = true;

      expect(root.hasVisibleChildren()).toBe(true);
      expect(parent.hasVisibleChildren()).toBe(true);
      expect(child.hasVisibleChildren()).toBe(false);
    });
  });

  describe('expand method', () => {
    const createMockTraceTree = () => ({
      list: [] as TestNode[],
    });

    it('should expand node and add visible children to tree list', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
      const child2 = new TestNode(parent, createMockValue({event_id: 'child2'}), extra);

      parent.children = [child1, child2];
      parent.expanded = false;

      const tree = createMockTraceTree();
      tree.list = [parent];

      const result = parent.expand(true, tree as any);

      expect(result).toBe(true);
      expect(parent.expanded).toBe(true);
      expect(tree.list).toHaveLength(3);
      expect(tree.list).toContain(child1);
      expect(tree.list).toContain(child2);
    });

    it('should collapse node and remove visible children from tree list', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      const child1 = new TestNode(parent, createMockValue({event_id: 'child1'}), extra);
      const child2 = new TestNode(parent, createMockValue({event_id: 'child2'}), extra);

      parent.children = [child1, child2];
      parent.expanded = true;

      const tree = createMockTraceTree();
      tree.list = [parent, child1, child2];

      const result = parent.expand(false, tree as any);

      expect(result).toBe(true);
      expect(parent.expanded).toBe(false);
      expect(tree.list).toHaveLength(1);
      expect(tree.list).toContain(parent);
      expect(tree.list).not.toContain(child1);
      expect(tree.list).not.toContain(child2);
    });

    it('should return false when trying to expand already expanded node', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      parent.expanded = true;

      const tree = createMockTraceTree();
      tree.list = [parent];

      const result = parent.expand(true, tree as any);

      expect(result).toBe(false);
      expect(parent.expanded).toBe(true);
    });

    it('should return false when trying to collapse already collapsed node', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      parent.expanded = false;

      const tree = createMockTraceTree();
      tree.list = [parent];

      const result = parent.expand(false, tree as any);

      expect(result).toBe(false);
      expect(parent.expanded).toBe(false);
    });

    it('should return false when node has already fetched children', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      parent.expanded = false;
      parent.hasFetchedChildren = true;

      const tree = createMockTraceTree();
      tree.list = [parent];

      const result = parent.expand(true, tree as any);

      expect(result).toBe(false);
      expect(parent.expanded).toBe(false);
    });

    it('should invalidate node and children after expansion', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      const child = new TestNode(parent, createMockValue({event_id: 'child'}), extra);

      parent.children = [child];
      parent.expanded = false;
      parent.depth = 1;
      parent.connectors = [1, 2];
      child.depth = 2;
      child.connectors = [2, 3];

      const tree = createMockTraceTree();
      tree.list = [parent];

      parent.expand(true, tree as any);

      expect(parent.depth).toBeUndefined();
      expect(parent.connectors).toBeUndefined();
      expect(child.depth).toBeUndefined();
      expect(child.connectors).toBeUndefined();
    });

    it('should handle nested expansion correctly', () => {
      const extra = createMockExtra();
      const root = new TestNode(null, createMockValue({event_id: 'root'}), extra);
      const parent = new TestNode(root, createMockValue({event_id: 'parent'}), extra);
      const child = new TestNode(parent, createMockValue({event_id: 'child'}), extra);

      root.children = [parent];
      parent.children = [child];
      root.expanded = false;
      parent.expanded = true;

      const tree = createMockTraceTree();
      tree.list = [root];

      root.expand(true, tree as any);

      // Should include parent and child since parent is expanded
      expect(tree.list).toHaveLength(3);
      expect(tree.list).toContain(root);
      expect(tree.list).toContain(parent);
      expect(tree.list).toContain(child);
    });
  });

  describe('boolean flags and properties', () => {
    it('should initialize boolean flags with correct defaults', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test'}), extra);

      expect(node.canFetchChildren).toBe(false);
      expect(node.hasFetchedChildren).toBe(false);
      expect(node.expanded).toBe(true);
      expect(node.allowNoInstrumentationNodes).toBe(false);
      expect(node.canAutogroup).toBe(false);
    });

    it('should allow modifying boolean flags', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test'}), extra);

      node.canFetchChildren = true;
      node.hasFetchedChildren = true;
      node.expanded = false;
      node.allowNoInstrumentationNodes = true;
      node.canAutogroup = true;

      expect(node.canFetchChildren).toBe(true);
      expect(node.hasFetchedChildren).toBe(true);
      expect(node.expanded).toBe(false);
      expect(node.allowNoInstrumentationNodes).toBe(true);
      expect(node.canAutogroup).toBe(true);
    });
  });

  describe('complex tree visibility scenarios', () => {
    it('should handle deep nesting with mixed expansion states', () => {
      const extra = createMockExtra();
      const root = new TestNode(null, createMockValue({event_id: 'root'}), extra);
      const level1 = new TestNode(root, createMockValue({event_id: 'level1'}), extra);
      const level2a = new TestNode(level1, createMockValue({event_id: 'level2a'}), extra);
      const level2b = new TestNode(level1, createMockValue({event_id: 'level2b'}), extra);
      const level3 = new TestNode(level2a, createMockValue({event_id: 'level3'}), extra);

      root.children = [level1];
      level1.children = [level2a, level2b];
      level2a.children = [level3];

      // Mixed expansion states
      root.expanded = true;
      level1.expanded = true;
      level2a.expanded = false; // This should hide level3
      level2b.expanded = true;

      const visibleChildren = root.visibleChildren;
      expect(visibleChildren).toContain(level1);
      expect(visibleChildren).toContain(level2a);
      expect(visibleChildren).toContain(level2b);
      expect(visibleChildren).not.toContain(level3); // Hidden due to level2a being collapsed
    });

    it('should handle circular reference prevention in visible children calculation', () => {
      const extra = createMockExtra();
      const parent = new TestNode(null, createMockValue({event_id: 'parent'}), extra);
      const child = new TestNode(parent, createMockValue({event_id: 'child'}), extra);

      parent.children = [child];
      parent.expanded = true;

      // This should not cause infinite recursion
      const visibleChildren = parent.visibleChildren;
      expect(visibleChildren).toHaveLength(1);
      expect(visibleChildren[0]).toBe(child);
    });

    it('should correctly calculate visible children with multiple branches', () => {
      const extra = createMockExtra();
      const root = new TestNode(null, createMockValue({event_id: 'root'}), extra);
      const branch1 = new TestNode(root, createMockValue({event_id: 'branch1'}), extra);
      const branch2 = new TestNode(root, createMockValue({event_id: 'branch2'}), extra);
      const leaf1a = new TestNode(branch1, createMockValue({event_id: 'leaf1a'}), extra);
      const leaf1b = new TestNode(branch1, createMockValue({event_id: 'leaf1b'}), extra);
      const leaf2 = new TestNode(branch2, createMockValue({event_id: 'leaf2'}), extra);

      root.children = [branch1, branch2];
      branch1.children = [leaf1a, leaf1b];
      branch2.children = [leaf2];

      root.expanded = true;
      branch1.expanded = true;
      branch2.expanded = false; // leaf2 should be hidden

      const visibleChildren = root.visibleChildren;
      expect(visibleChildren).toHaveLength(4); // branch1, leaf1a, leaf1b, branch2
      expect(visibleChildren).toContain(branch1);
      expect(visibleChildren).toContain(branch2);
      expect(visibleChildren).toContain(leaf1a);
      expect(visibleChildren).toContain(leaf1b);
      expect(visibleChildren).not.toContain(leaf2);
    });
  });

  describe('connector and depth management', () => {
    it('should initialize depth and connectors as undefined', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test'}), extra);

      expect(node.depth).toBeUndefined();
      expect(node.connectors).toBeUndefined();
    });

    it('should allow setting depth and connectors', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test'}), extra);

      node.depth = 5;
      node.connectors = [1, 2, 3, 4];

      expect(node.depth).toBe(5);
      expect(node.connectors).toEqual([1, 2, 3, 4]);
    });

    it('should clear depth and connectors when invalidated', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test'}), extra);

      node.depth = 10;
      node.connectors = [5, 6, 7];

      node.invalidate();

      expect(node.depth).toBeUndefined();
      expect(node.connectors).toBeUndefined();
    });
  });

  describe('findParentTransaction', () => {
    it('should return null when no transaction parent exists', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test'}), extra);

      expect(node.findParentNodeStoreTransaction()).toBeNull();
    });

    it('should find parent transaction node', () => {
      const extra = createMockExtra();
      const mockTransactionParent = {
        type: 'txn',
        id: 'transaction-parent',
      };

      const child = new TestNode(null, createMockValue({event_id: 'child'}), extra);
      jest.spyOn(child, 'findParent').mockReturnValue(mockTransactionParent as any);

      const result = child.findParentNodeStoreTransaction();
      expect(result).toBe(mockTransactionParent);
      expect(child.findParent).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('findParentEapTransaction', () => {
    it('should return null when no EAP transaction parent exists', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test'}), extra);

      expect(node.findParentEapTransaction()).toBeNull();
    });

    it('should find parent EAP transaction node', () => {
      const extra = createMockExtra();
      const mockEapTransactionParent = {
        type: 'eap_span',
        id: 'eap-transaction-parent',
        value: {is_transaction: true},
      };

      const child = new TestNode(null, createMockValue({event_id: 'child'}), extra);
      jest.spyOn(child, 'findParent').mockReturnValue(mockEapTransactionParent as any);

      const result = child.findParentEapTransaction();
      expect(result).toBe(mockEapTransactionParent);
      expect(child.findParent).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('hasErrors getter', () => {
    it('should return false when node has no errors', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test'}), extra);

      expect(node.hasErrors).toBe(false);
    });

    it('should return true when node has errors', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test'}), extra);

      node.errors.add(
        makeTraceError({
          issue_id: 1,
          event_id: 'error-1',
        })
      );

      expect(node.hasErrors).toBe(true);
    });
  });

  describe('hasOccurrences getter', () => {
    it('should return false when node has no occurrences', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test'}), extra);

      expect(node.hasOccurrences).toBe(false);
    });

    it('should return true when node has occurrences', () => {
      const extra = createMockExtra();
      const node = new TestNode(null, createMockValue({event_id: 'test'}), extra);

      node.occurrences.add(
        makeEAPOccurrence({
          issue_id: 1,
          event_id: 'occurrence-1',
        })
      );

      expect(node.hasOccurrences).toBe(true);
    });
  });
});
