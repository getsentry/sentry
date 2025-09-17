import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {makeUptimeCheckTiming} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import type {TraceTreeNodeExtra} from './baseNode';
import {UptimeCheckTimingNode} from './uptimeCheckTimingNode';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

describe('UptimeCheckTimingNode', () => {
  describe('constructor', () => {
    it('should initialize with basic properties', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        event_id: 'timing-1',
        op: 'dns.lookup.duration',
        description: 'DNS lookup',
        start_timestamp: 0,
        end_timestamp: 0.05,
        duration: 0.05,
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.parent).toBeNull();
      expect(node.value).toBe(timingValue);
      expect(node.extra).toBe(extra);
      expect(node.value.event_type).toBe('uptime_check_timing');
    });

    it('should handle different timing phases', () => {
      const extra = createMockExtra();

      const timingPhases = [
        {
          op: 'dns.lookup.duration',
          description: 'DNS lookup',
        },
        {
          op: 'http.tcp_connection.duration',
          description: 'TCP connect',
        },
        {
          op: 'tls.handshake.duration',
          description: 'TLS handshake',
        },
        {
          op: 'http.client.request.duration',
          description: 'Send request',
        },
        {
          op: 'http.server.time_to_first_byte',
          description: 'Waiting for response',
        },
        {
          op: 'http.client.response.duration',
          description: 'Receive response',
        },
      ];

      timingPhases.forEach((phase, index) => {
        const timingValue = makeUptimeCheckTiming({
          event_id: `timing-${index}`,
          op: phase.op,
          description: phase.description,
        });

        const node = new UptimeCheckTimingNode(null, timingValue, extra);

        expect(node.value.op).toBe(phase.op);
        expect(node.value.description).toBe(phase.description);
        expect(node.parent).toBeNull();
      });
    });

    it('should handle timing with different durations', () => {
      const extra = createMockExtra();

      const timingValue = makeUptimeCheckTiming({
        event_id: 'timing-duration-test',
        start_timestamp: 1.5,
        end_timestamp: 3.2,
        duration: 1.7,
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.value.start_timestamp).toBe(1.5);
      expect(node.value.end_timestamp).toBe(3.2);
      expect(node.value.duration).toBe(1.7);
    });
  });

  describe('getter methods', () => {
    it('should return drawerTabsTitle from description when available', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'dns.lookup.duration',
        description: 'DNS lookup phase',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.drawerTabsTitle).toBe('DNS lookup phase');
    });

    it('should return drawerTabsTitle from op when description is not available', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'custom.operation',
        description: undefined,
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.drawerTabsTitle).toBe('custom.operation');
    });

    it('should return drawerTabsTitle from op when description is empty', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'tcp.connection',
        description: '',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.drawerTabsTitle).toBe('tcp.connection');
    });

    it('should return traceHeaderTitle from description when available', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'tls.handshake.duration',
        description: 'TLS handshake phase',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'TLS handshake phase',
        subtitle: undefined,
      });
    });

    it('should return traceHeaderTitle from op when description is not available', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'http.request.send',
        description: undefined,
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'http.request.send',
        subtitle: undefined,
      });
    });
  });

  describe('abstract method implementations', () => {
    it('should return correct pathToNode', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        event_id: 'timing-123',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      const path = node.pathToNode();
      expect(path).toEqual(['uptime-check-timing-timing-123']);
    });

    it('should return correct analyticsName', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        event_id: 'timing-analytics-test',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.analyticsName()).toBe('timing-analytics-test');
    });

    it('should return correct printNode', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        event_id: 'timing-print-test',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.printNode()).toBe('timing-print-test');
    });

    it('should render waterfall row', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({});

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      const mockProps = {
        node: node as any,
        theme: ThemeFixture(),
        organization: OrganizationFixture(),
        manager: {} as any,
        projects: [],
      } as unknown as TraceRowProps<any>;

      const result = node.renderWaterfallRow(mockProps);
      expect(result).toBeDefined();
    });

    it('should render details component', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({});

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

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
    it('should match by description (case insensitive)', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'dns.lookup.duration',
        description: 'DNS Lookup Phase',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.matchWithFreeText('dns')).toBe(true);
      expect(node.matchWithFreeText('DNS')).toBe(true);
      expect(node.matchWithFreeText('lookup')).toBe(true);
      expect(node.matchWithFreeText('LOOKUP')).toBe(true);
      expect(node.matchWithFreeText('phase')).toBe(true);
      expect(node.matchWithFreeText('dns lookup')).toBe(true);
      expect(node.matchWithFreeText('Lookup Phase')).toBe(true);
    });

    it('should match by operation (case insensitive)', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'http.tcp_connection.duration',
        description: 'TCP Connection',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.matchWithFreeText('http')).toBe(true);
      expect(node.matchWithFreeText('HTTP')).toBe(true);
      expect(node.matchWithFreeText('tcp')).toBe(true);
      expect(node.matchWithFreeText('TCP')).toBe(true);
      expect(node.matchWithFreeText('connection')).toBe(true);
      expect(node.matchWithFreeText('duration')).toBe(true);
      expect(node.matchWithFreeText('tcp_connection')).toBe(true);
    });

    it('should prioritize description over operation when both match', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'test.operation',
        description: 'Test Description',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      // Both description and operation contain 'test'
      expect(node.matchWithFreeText('test')).toBe(true);
      expect(node.matchWithFreeText('TEST')).toBe(true);
    });

    it('should not match when query does not exist in description or operation', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'dns.lookup.duration',
        description: 'DNS Lookup',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.matchWithFreeText('nonexistent')).toBe(false);
      expect(node.matchWithFreeText('database')).toBe(false);
      expect(node.matchWithFreeText('http')).toBe(false);
    });

    it('should handle undefined description gracefully', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'custom.operation',
        description: undefined,
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      // Should still match by operation
      expect(node.matchWithFreeText('custom')).toBe(true);
      expect(node.matchWithFreeText('operation')).toBe(true);
      // Should not match undefined description
      expect(node.matchWithFreeText('undefined')).toBe(false);
    });

    it('should handle undefined operation gracefully', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: undefined as any,
        description: 'Valid Description',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      // Should still match by description
      expect(node.matchWithFreeText('valid')).toBe(true);
      expect(node.matchWithFreeText('description')).toBe(true);
      // Should not match undefined operation
      expect(node.matchWithFreeText('undefined')).toBe(false);
    });

    it('should handle empty strings', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: '',
        description: '',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.matchWithFreeText('anything')).toBe(false);
      expect(node.matchWithFreeText('')).toBe(false);
    });

    it('should handle partial matches', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'dns.lookup.duration',
        description: 'DNS Resolution Phase',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.matchWithFreeText('dn')).toBe(true); // Partial match in op
      expect(node.matchWithFreeText('resol')).toBe(true); // Partial match in description
      expect(node.matchWithFreeText('lookup.dur')).toBe(true); // Partial match across words
      expect(node.matchWithFreeText('xyz')).toBe(false); // No partial match
    });
  });

  describe('makeBarColor', () => {
    it('should return color based on operation', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'dns.lookup.duration',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      const theme = ThemeFixture();
      const color = node.makeBarColor(theme);

      expect(color).toBeDefined();
      expect(typeof color).toBe('string');
      // Should be a valid color (either hex or theme color)
      expect(
        color.startsWith('#') ||
          color.startsWith('rgb') ||
          theme[color as keyof typeof theme]
      ).toBeTruthy();
    });

    it('should handle different timing operations', () => {
      const extra = createMockExtra();
      const theme = ThemeFixture();

      const operations = [
        'dns.lookup.duration',
        'http.tcp_connection.duration',
        'tls.handshake.duration',
        'http.client.request.duration',
        'http.server.time_to_first_byte',
        'http.client.response.duration',
      ];

      operations.forEach(op => {
        const timingValue = makeUptimeCheckTiming({op});
        const node = new UptimeCheckTimingNode(null, timingValue, extra);

        const color = node.makeBarColor(theme);
        expect(color).toBeDefined();
        expect(typeof color).toBe('string');
      });
    });

    it('should handle custom operations', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'custom.timing.operation',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      const theme = ThemeFixture();
      const color = node.makeBarColor(theme);

      expect(color).toBeDefined();
      expect(typeof color).toBe('string');
    });
  });
});
