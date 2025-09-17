import type {Theme} from '@emotion/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {
  makeEAPError,
  makeTraceError,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import type {TraceTreeNodeExtra} from './baseNode';
import {ErrorNode} from './errorNode';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

describe('ErrorNode', () => {
  describe('constructor', () => {
    it('should initialize with basic properties for TraceError', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'error',
        message: 'Something went wrong',
        timestamp: 1000,
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.parent).toBeNull();
      expect(node.value).toBe(value);
      expect(node.extra).toBe(extra);
      expect(node.space).toEqual([1000000, 0]); // timestamp * 1e3
      expect(node.errors.size).toBe(1);
      expect(node.errors.has(value)).toBe(true);
    });

    it('should initialize with basic properties for EAPError', () => {
      const extra = createMockExtra();
      const value = makeEAPError({
        event_id: 'test-eap-error',
        description: 'EAP Error Description',
        level: 'warning',
        project_id: 1,
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.parent).toBeNull();
      expect(node.value).toBe(value);
      expect(node.extra).toBe(extra);
      expect(node.errors.size).toBe(1);
      expect(node.errors.has(value)).toBe(true);
    });

    it('should handle TraceError without timestamp', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'error',
        timestamp: undefined,
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.space).toEqual([0, 0]); // default space when no timestamp
    });

    it('should handle null value gracefully', () => {
      const extra = createMockExtra();

      const node = new ErrorNode(null, null as any, extra);

      expect(node.parent).toBeNull();
      expect(node.value).toBeNull();
      expect(node.extra).toBe(extra);
    });

    it('should add error to errors set', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.errors.size).toBe(1);
      expect(Array.from(node.errors)).toContain(value);
    });
  });

  describe('getter methods', () => {
    it('should return correct description for TraceError with title', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Database Connection Error',
        message: 'Could not connect to database',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.description).toBe('Database Connection Error');
    });

    it('should return correct description for TraceError with message fallback', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: undefined,
        message: 'Could not connect to database',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.description).toBe('Could not connect to database');
    });

    it('should return correct description for EAPError', () => {
      const extra = createMockExtra();
      const value = makeEAPError({
        description: 'EAP Error Description',
        level: 'warning',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.description).toBe('EAP Error Description');
    });

    it('should return correct traceHeaderTitle', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'Trace',
        subtitle: 'Test Error',
      });
    });

    it('should return correct drawerTabsTitle with description', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.drawerTabsTitle).toBe('Test Error');
    });

    it('should return fallback drawerTabsTitle without description', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: undefined,
        message: undefined,
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.drawerTabsTitle).toBe('Error');
    });
  });

  describe('abstract method implementations', () => {
    it('should return correct pathToNode', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        event_id: 'test-error-id',
        title: 'Test Error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.pathToNode()).toEqual(['error-test-error-id']);
    });

    it('should return correct analyticsName for TraceError', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.analyticsName()).toBe('error');
    });

    it('should return correct analyticsName for EAPError', () => {
      const extra = createMockExtra();
      const value = makeEAPError({
        description: 'EAP Error',
        level: 'warning',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.analyticsName()).toBe('eap error');
    });

    it('should return correct printNode with id', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        event_id: 'test-error-id',
        title: 'Test Error',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.printNode()).toBe('test-error-id');
    });

    it('should return correct printNode with level fallback', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        event_id: undefined,
        title: 'Test Error',
        level: 'warning',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.printNode()).toBe('warning');
    });

    it('should return fallback printNode', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        event_id: undefined,
        title: 'Test Error',
        level: undefined,
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.printNode()).toBe('unknown trace error');
    });

    it('should render waterfall row', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      const mockProps = {
        node: node as any,
        theme: {} as any,
        organization: OrganizationFixture(),
        manager: {} as any,
        projects: [],
      } as unknown as TraceRowProps<any>;

      const result = node.renderWaterfallRow(mockProps);
      expect(result).toBeDefined();
    });

    it('should render details', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      const mockProps = {
        node: node as any,
        organization: OrganizationFixture(),
        onParentClick: jest.fn(),
        onTabScrollToNode: jest.fn(),
      } as unknown as TraceTreeNodeDetailsProps<any>;

      const result = node.renderDetails(mockProps);
      expect(result).toBeDefined();
    });
  });

  describe('matchWithFreeText', () => {
    it('should match by error level', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Database Error',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.matchWithFreeText('error')).toBe(true);
      expect(node.matchWithFreeText('warning')).toBe(false);
    });

    it('should match by description content', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Database Connection Error',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.matchWithFreeText('Database')).toBe(true);
      expect(node.matchWithFreeText('Connection')).toBe(true);
      expect(node.matchWithFreeText('Error')).toBe(true);
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });

    it('should match EAPError by description', () => {
      const extra = createMockExtra();
      const value = makeEAPError({
        description: 'API Request Failed',
        level: 'warning',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.matchWithFreeText('API')).toBe(true);
      expect(node.matchWithFreeText('Request')).toBe(true);
      expect(node.matchWithFreeText('Failed')).toBe(true);
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });

    it('should handle undefined description gracefully', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: undefined,
        message: undefined,
        level: 'info',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.matchWithFreeText('info')).toBe(true);
      expect(node.matchWithFreeText('anything')).toBe(false);
    });

    it('should be case sensitive', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'DATABASE ERROR',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.matchWithFreeText('DATABASE')).toBe(true);
      expect(node.matchWithFreeText('database')).toBe(false);
      expect(node.matchWithFreeText('ERROR')).toBe(true);
      expect(node.matchWithFreeText('error')).toBe(true); // level match is exact
    });
  });

  describe('makeBarColor', () => {
    const mockTheme: Partial<Theme> = {
      red300: '#ff6b6b',
      yellow300: '#ffd93d',
      level: {
        error: '#ff4757',
        warning: '#ffa502',
        info: '#3742fa',
        fatal: '#ff3838',
        sample: '#ff6b6b',
        unknown: '#ff6b6b',
        default: '#ff6b6b',
      },
    };

    it('should return red for error level', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.makeBarColor(mockTheme as Theme)).toBe('#ff6b6b');
    });

    it('should return red for fatal level', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'fatal',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.makeBarColor(mockTheme as Theme)).toBe('#ff6b6b');
    });

    it('should return theme level color for warning', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Warning',
        level: 'warning',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.makeBarColor(mockTheme as Theme)).toBe('#ffa502');
    });

    it('should return theme level color for info', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Info',
        level: 'info',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.makeBarColor(mockTheme as Theme)).toBe('#3742fa');
    });

    it('should return red fallback for unknown level', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'unknown' as any,
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.makeBarColor(mockTheme as Theme)).toBe('#ff6b6b');
    });

    it('should return red fallback for undefined level', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: undefined,
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.makeBarColor(mockTheme as Theme)).toBe('#ff6b6b');
    });

    it('should handle EAPError levels', () => {
      const extra = createMockExtra();
      const value = makeEAPError({
        description: 'EAP Warning',
        level: 'warning',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.makeBarColor(mockTheme as Theme)).toBe('#ffa502');
    });
  });

  describe('edge cases', () => {
    it('should handle TraceError with empty strings', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: '',
        message: '',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.description).toBe('');
      expect(node.drawerTabsTitle).toBe('Error'); // fallback
    });

    it('should handle EAPError with empty description', () => {
      const extra = createMockExtra();
      const value = makeEAPError({
        description: '',
        level: 'warning',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.description).toBe('');
      expect(node.drawerTabsTitle).toBe('Error'); // fallback
    });

    it('should handle missing event_id gracefully', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        event_id: undefined,
        title: 'Test Error',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.pathToNode()).toEqual(['error-undefined']);
      expect(node.printNode()).toBe('error'); // falls back to level
    });

    it('should handle TraceError with only message', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: undefined,
        message: 'Only message available',
        level: 'info',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.description).toBe('Only message available');
      expect(node.drawerTabsTitle).toBe('Only message available');
    });

    it('should handle space calculation with zero timestamp', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'error',
        timestamp: 0,
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.space).toEqual([0, 0]);
    });
  });
});
