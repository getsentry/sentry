import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {makeUptimeCheckTiming} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import type {TraceTreeNodeExtra} from './baseNode';
import {UptimeCheckTimingNode} from './uptimeCheckTimingNode';

const createMockExtra = (): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
});

describe('UptimeCheckTimingNode', () => {
  describe('constructor', () => {
    it('should initialize with timing value', () => {
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

      expect(node.value).toBe(timingValue);
      expect(node.value.event_type).toBe('uptime_check_timing');
    });
  });

  describe('drawerTabsTitle', () => {
    it('should return description when available', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'dns.lookup.duration',
        description: 'DNS lookup phase',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.drawerTabsTitle).toBe('DNS lookup phase');
    });

    it('should return op when description is not available', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'custom.operation',
        description: undefined,
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.drawerTabsTitle).toBe('custom.operation');
    });
  });

  describe('traceHeaderTitle', () => {
    it('should return description as title when available', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'tls.handshake.duration',
        description: 'TLS handshake phase',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'TLS handshake phase',
      });
    });

    it('should return op as title when description is not available', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'http.request.send',
        description: undefined,
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'http.request.send',
      });
    });
  });

  describe('pathToNode', () => {
    it('should return uptime-check-timing path with event ID', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        event_id: 'timing-123',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.pathToNode()).toEqual(['uptime-check-timing-timing-123']);
    });
  });

  describe('analyticsName', () => {
    it('should return event ID', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        event_id: 'timing-analytics-test',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.analyticsName()).toBe('timing-analytics-test');
    });
  });

  describe('printNode', () => {
    it('should return event ID', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        event_id: 'timing-print-test',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.printNode()).toBe('timing-print-test');
    });
  });

  describe('matchWithFreeText', () => {
    it('should match by path', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        event_id: 'timing123',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.matchByPath('uptime-check-timing-timing123')).toBe(true);
      expect(node.matchByPath('uptime-check-timing-timing456')).toBe(false);
    });

    it('should match by description', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'dns.lookup.duration',
        description: 'DNS Lookup Phase',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.matchWithFreeText('DNS')).toBe(true);
      expect(node.matchWithFreeText('lookup')).toBe(true);
    });

    it('should match by operation', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'http.tcp_connection.duration',
        description: 'TCP Connection',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.matchWithFreeText('http')).toBe(true);
      expect(node.matchWithFreeText('tcp')).toBe(true);
    });

    it('should match by exact ID', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        event_id: 'timing-123',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.matchWithFreeText('timing-123')).toBe(true);
    });

    it('should not match unrelated text', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'dns.lookup.duration',
        description: 'DNS Lookup',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });
  });

  describe('makeBarColor', () => {
    it('should return color based on operation', () => {
      const extra = createMockExtra();
      const timingValue = makeUptimeCheckTiming({
        op: 'dns.lookup.duration',
      });

      const node = new UptimeCheckTimingNode(null, timingValue, extra);

      const color = node.makeBarColor(ThemeFixture());

      expect(color).toBeDefined();
      expect(typeof color).toBe('string');
    });
  });
});
