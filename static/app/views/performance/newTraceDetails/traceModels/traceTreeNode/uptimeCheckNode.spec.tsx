import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {makeUptimeCheck} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import type {TraceTreeNodeExtra} from './baseNode';
import {RootNode} from './rootNode';
import {UptimeCheckNode} from './uptimeCheckNode';
import {UptimeCheckTimingNode} from './uptimeCheckTimingNode';

const createMockExtra = (): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
});

describe('UptimeCheckNode', () => {
  describe('constructor', () => {
    it('should initialize with basic properties', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({});
      const node = new UptimeCheckNode(null, uptimeValue, extra);

      expect(node.isEAPEvent).toBe(true);
      expect(node.searchPriority).toBe(1);
    });

    it('should create timing nodes and add to parent', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-1',
        additional_attributes: {
          dns_lookup_duration_us: 1000,
          tcp_connection_duration_us: 2000,
        },
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      // Should create 6 timing nodes
      expect(node.children).toHaveLength(6);
      expect(parentNode.children).toContain(node);

      // All children should be UptimeCheckTimingNode instances
      node.children.forEach(child => {
        expect(child).toBeInstanceOf(UptimeCheckTimingNode);
        expect(child.id).toBe(`uptime-check-1-${child.op}`);
        expect(child.parent).toBe(node);
      });
    });

    it('should handle missing additional_attributes with defaults', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-1',
        additional_attributes: {
          dns_lookup_duration_us: 5000,
          // Missing other attributes should default to 0
        },
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.children).toHaveLength(6);

      const dnsNode = node.children.find(
        child => child.op === 'dns.lookup.duration'
      ) as UptimeCheckTimingNode;
      expect(dnsNode?.value.duration).toBe(0.005); // 5000 us = 0.005 s
    });
  });

  describe('_createTimingNodes', () => {
    it('should create all six timing phases with correct ops and descriptions', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-1',
        additional_attributes: {
          dns_lookup_duration_us: 1000,
          dns_lookup_start_us: 0,
          tcp_connection_duration_us: 2000,
          tcp_connection_start_us: 1000,
        },
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      const expectedOps = [
        'dns.lookup.duration',
        'http.tcp_connection.duration',
        'tls.handshake.duration',
        'http.client.request.duration',
        'http.server.time_to_first_byte',
        'http.client.response.duration',
      ];

      const expectedDescriptions = [
        'DNS lookup',
        'TCP connect',
        'TLS handshake',
        'Send request',
        'Waiting for response',
        'Receive response',
      ];

      expect(node.children).toHaveLength(6);

      expectedOps.forEach((expectedOp, index) => {
        const child = node.children.find(c => c.op === expectedOp);
        expect(child).toBeDefined();
        expect(child?.description).toBe(expectedDescriptions[index]);
        expect((child as UptimeCheckTimingNode).value.event_type).toBe(
          'uptime_check_timing'
        );
      });
    });

    it('should calculate correct timestamps and space bounds', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-1',
        additional_attributes: {
          dns_lookup_duration_us: 5000,
          dns_lookup_start_us: 1000,
        },
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      const dnsNode = node.children.find(
        child => child.op === 'dns.lookup.duration'
      ) as UptimeCheckTimingNode;

      expect(dnsNode?.space).toEqual([1, 5]); // 1ms start, 5ms duration
      expect(dnsNode?.value.start_timestamp).toBe(0.001); // 1000 us = 0.001 s
      expect(dnsNode?.value.duration).toBe(0.005); // 5000 us = 0.005 s
      expect(dnsNode?.value.end_timestamp).toBe(0.006); // start + duration
    });
  });

  describe('description getter', () => {
    it('should return name', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        name: 'Health Check API',
        description: 'Monitors API endpoint health',
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.description).toBe('Health Check API');
    });
  });

  describe('drawerTabsTitle', () => {
    it('should combine op and description', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        op: 'uptime_check',
        description: 'API Health Check',
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.drawerTabsTitle).toBe('uptime_check - API Health Check');
    });

    it('should return op only when description is missing', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        op: 'uptime_check',
        description: undefined,
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.drawerTabsTitle).toBe('uptime_check');
    });
  });

  describe('traceHeaderTitle', () => {
    it('should return title and subtitle with method and URL', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        additional_attributes: {
          method: 'GET',
          request_url: 'https://api.example.com/health',
        },
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'Uptime Monitor Check',
        subtitle: 'GET https://api.example.com/health',
      });
    });
  });

  describe('pathToNode', () => {
    it('should return uptime-check path with event ID', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        event_id: 'check123',
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.pathToNode()).toEqual(['uptime-check-check123']);
    });
  });

  describe('analyticsName', () => {
    it('should return "uptime check"', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({});

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.analyticsName()).toBe('uptime check');
    });
  });

  describe('printNode', () => {
    it('should format with event ID', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-456',
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.printNode()).toBe('uptime check uptime-check-456');
    });
  });

  describe('matchWithFreeText', () => {
    it('should match by path', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        event_id: 'check123',
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.matchByPath('uptime-check-check123')).toBe(true);
      expect(node.matchByPath('uptime-check-check456')).toBe(false);
    });

    it('should match by operation', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        op: 'uptime_check',
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.matchWithFreeText('uptime')).toBe(true);
      expect(node.matchWithFreeText('check')).toBe(true);
    });

    it('should match by name', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        name: 'API Health Monitor',
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.matchWithFreeText('API')).toBe(true);
      expect(node.matchWithFreeText('Health')).toBe(true);
    });

    it('should match by event ID', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-789',
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.matchWithFreeText('uptime-check-789')).toBe(true);
    });

    it('should not match unrelated text', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        op: 'uptime_check',
        description: 'API Health Monitor',
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });
  });

  describe('makeBarColor', () => {
    it('should return color based on operation', () => {
      const extra = createMockExtra();
      const uptimeValue = makeUptimeCheck({
        op: 'uptime_check',
      });

      const parentNode = new RootNode(null, null, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      const color = node.makeBarColor(ThemeFixture());

      expect(color).toBeDefined();
      expect(typeof color).toBe('string');
    });
  });
});
