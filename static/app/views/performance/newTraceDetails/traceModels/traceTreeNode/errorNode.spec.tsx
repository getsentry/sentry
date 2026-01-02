import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {
  makeEAPError,
  makeTraceError,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

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
      expect(node.isEAPEvent).toBe(false);
      expect(node.searchPriority).toBe(3);
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
      expect(node.isEAPEvent).toBe(false);
    });

    it('should handle different timestamp formats', () => {
      const extra = createMockExtra();
      const parentValue = makeTraceError({
        event_id: 'parent',
        title: 'Parent Error',
        timestamp: 1000,
      });
      const errorValue1 = makeTraceError({
        event_id: 'error1',
        title: 'Error with timestamp',
        timestamp: 1500,
      });
      const errorValue2 = makeTraceError({
        event_id: 'error2',
        title: 'Error without timestamp',
        timestamp: undefined,
      });

      const parent = new ErrorNode(null, parentValue, extra);
      const error1 = new ErrorNode(parent, errorValue1, extra);
      const error2 = new ErrorNode(parent, errorValue2, extra);

      expect(error1.space).toEqual([1500000, 0]);
      expect(error2.space).toEqual([0, 0]);
      expect(parent.children).toContain(error1);
      expect(parent.children).toContain(error2);
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

    it('should handle EAPError space calculation', () => {
      const extra = createMockExtra();
      const value = makeEAPError({
        event_id: 'test-eap-error',
        description: 'EAP Error Description',
        level: 'warning',
      });

      const node = new ErrorNode(null, value, extra);

      // EAPError doesn't have timestamp, so should use base space calculation
      expect(node.space).toEqual([0, 0]);
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

  describe('description getter', () => {
    it('should prioritize title over message for TraceError', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Database Connection Error',
        message: 'Could not connect to database',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.description).toBe('Database Connection Error');
    });

    it('should fallback to message when title is undefined for TraceError', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: undefined,
        message: 'Could not connect to database',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.description).toBe('Could not connect to database');
    });

    it('should fallback to message when title is empty string for TraceError', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: '',
        message: 'Could not connect to database',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.description).toBe('Could not connect to database');
    });

    it('should return empty string when both title and message are empty for TraceError', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: '',
        message: '',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.description).toBe('');
    });

    it('should return undefined when both title and message are undefined for TraceError', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: undefined,
        message: undefined,
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.description).toBeUndefined();
    });

    it('should return description for EAPError', () => {
      const extra = createMockExtra();
      const value = makeEAPError({
        description: 'EAP Error Description',
        level: 'warning',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.description).toBe('EAP Error Description');
    });

    it('should handle empty description for EAPError', () => {
      const extra = createMockExtra();
      const value = makeEAPError({
        description: '',
        level: 'warning',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.description).toBe('');
    });

    it('should handle undefined description for EAPError', () => {
      const extra = createMockExtra();
      const value = makeEAPError({
        description: undefined,
        level: 'warning',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.description).toBeUndefined();
    });
  });

  describe('getter methods', () => {
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

    it('should return correct traceHeaderTitle with undefined description', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: undefined,
        message: undefined,
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'Trace',
        subtitle: undefined,
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

    it('should return fallback drawerTabsTitle with empty description', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: '',
        message: '',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.drawerTabsTitle).toBe('Error');
    });
  });

  describe('abstract method implementations', () => {
    it('should return correct matchByPath', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        event_id: 'errorId',
        title: 'Test Error',
      });

      const node = new ErrorNode(null, value, extra);

      expect(node.matchByPath('error-errorId')).toBe(true);
      expect(node.matchByPath('txn-errorId')).toBe(false);
    });

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
    it('should return red400 for error level (overriding theme.level.error)', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'error',
      });

      const node = new ErrorNode(null, value, extra);
      const theme = ThemeFixture();

      // ErrorNode specifically returns red400 for errors, not theme.level.error
      expect(node.makeBarColor(theme)).toBe(theme.colors.red400);
    });

    it('should return red400 for fatal level (overriding theme.level.fatal)', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'fatal',
      });

      const node = new ErrorNode(null, value, extra);
      const theme = ThemeFixture();

      // ErrorNode specifically returns red400 for fatal, not theme.level.fatal
      expect(node.makeBarColor(theme)).toBe(theme.colors.red400);
    });

    it('should return theme level color for warning', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Warning',
        level: 'warning',
      });

      const node = new ErrorNode(null, value, extra);
      const theme = ThemeFixture();

      expect(node.makeBarColor(theme)).toBe(theme.level.warning);
    });

    it('should return theme level color for info', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Info',
        level: 'info',
      });

      const node = new ErrorNode(null, value, extra);
      const theme = ThemeFixture();

      expect(node.makeBarColor(theme)).toBe(theme.level.info);
    });

    it('should return theme level color for sample', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Sample',
        level: 'sample',
      });

      const node = new ErrorNode(null, value, extra);
      const theme = ThemeFixture();

      expect(node.makeBarColor(theme)).toBe(theme.level.sample);
    });

    it('should return red fallback for level not in theme.level', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: 'custom-level' as any,
      });

      const node = new ErrorNode(null, value, extra);
      const theme = ThemeFixture();

      expect(node.makeBarColor(theme)).toBe(theme.colors.red400);
    });

    it('should return red fallback for undefined level', () => {
      const extra = createMockExtra();
      const value = makeTraceError({
        title: 'Test Error',
        level: undefined,
      });

      const node = new ErrorNode(null, value, extra);
      const theme = ThemeFixture();

      expect(node.makeBarColor(theme)).toBe(theme.colors.red400);
    });

    it('should handle EAPError levels correctly', () => {
      const extra = createMockExtra();
      const warningValue = makeEAPError({
        description: 'EAP Warning',
        level: 'warning',
      });
      const errorValue = makeEAPError({
        description: 'EAP Error',
        level: 'error',
      });

      const warningNode = new ErrorNode(null, warningValue, extra);
      const errorNode = new ErrorNode(null, errorValue, extra);
      const theme = ThemeFixture();

      expect(warningNode.makeBarColor(theme)).toBe(theme.level.warning);
      expect(errorNode.makeBarColor(theme)).toBe(theme.colors.red400); // red400 for error
    });

    it('should prioritize red400 over theme.level for error/fatal', () => {
      const extra = createMockExtra();
      const errorValue = makeTraceError({
        title: 'Test Error',
        level: 'error',
      });
      const fatalValue = makeTraceError({
        title: 'Test Fatal',
        level: 'fatal',
      });

      const errorNode = new ErrorNode(null, errorValue, extra);
      const fatalNode = new ErrorNode(null, fatalValue, extra);
      const theme = ThemeFixture();

      // Should use red400, not theme.level colors
      expect(errorNode.makeBarColor(theme)).toBe(theme.colors.red400);
      expect(fatalNode.makeBarColor(theme)).toBe(theme.colors.red400);
    });
  });
});
