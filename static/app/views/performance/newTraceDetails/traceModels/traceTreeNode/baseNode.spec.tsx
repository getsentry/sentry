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
      expect(node.children).toEqual([]);
      expect(node.errors).toBeInstanceOf(Set);
      expect(node.occurrences).toBeInstanceOf(Set);
      expect(node.profiles).toBeInstanceOf(Set);
      expect(node.opsBreakdown).toEqual([]);
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
