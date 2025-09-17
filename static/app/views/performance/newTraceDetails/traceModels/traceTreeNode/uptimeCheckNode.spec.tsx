import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {
  makeEAPSpan,
  makeUptimeCheck,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import type {TraceTreeNodeExtra} from './baseNode';
import {EapSpanNode} from './eapSpanNode';
import {UptimeCheckNode} from './uptimeCheckNode';
import {UptimeCheckTimingNode} from './uptimeCheckTimingNode';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

describe('UptimeCheckNode', () => {
  describe('constructor', () => {
    it('should initialize with basic properties', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({
        event_id: 'parent',
        is_transaction: true,
      });
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-1',
        name: 'API Health Check',
        description: 'Check API endpoint status',
        op: 'uptime_check',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.parent).toBe(parentNode);
      expect(node.value).toBe(uptimeValue);
      expect(node.extra).toBe(extra);
      expect(node.value.event_type).toBe('uptime_check');
    });

    it('should create timing nodes in constructor', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-1',
        additional_attributes: {
          dns_lookup_duration_us: 1000,
          dns_lookup_start_us: 0,
          tcp_connection_duration_us: 2000,
          tcp_connection_start_us: 1000,
          tls_handshake_duration_us: 3000,
          tls_handshake_start_us: 3000,
          send_request_duration_us: 500,
          send_request_start_us: 6000,
          time_to_first_byte_duration_us: 10000,
          time_to_first_byte_start_us: 6500,
          receive_response_duration_us: 1500,
          receive_response_start_us: 16500,
        },
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      // Should create 6 timing nodes
      expect(node.children).toHaveLength(6);

      // All children should be UptimeCheckTimingNode instances
      node.children.forEach(child => {
        expect(child).toBeInstanceOf(UptimeCheckTimingNode);
        expect(child.parent).toBe(node);
      });
    });

    it('should handle partial additional_attributes', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-1',
        additional_attributes: {
          dns_lookup_duration_us: 5000,
          tcp_connection_start_us: 2000,
          // Missing other attributes
        },
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.children).toHaveLength(6);

      // Check that provided values are used and missing ones default to 0
      const dnsNode = node.children.find(
        child => child.op === 'dns.lookup.duration'
      ) as UptimeCheckTimingNode;
      expect(dnsNode?.value.duration).toBe(0.005); // 5000 us = 0.005 s

      const tcpNode = node.children.find(
        child => child.op === 'http.tcp_connection.duration'
      ) as UptimeCheckTimingNode;
      expect(tcpNode?.value.start_timestamp).toBe(0.002); // 2000 us = 0.002 s
      expect(tcpNode?.value.duration).toBe(0); // Missing duration
    });
  });

  describe('_createTimingNodes', () => {
    it('should create correctly ordered timing nodes', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-1',
        additional_attributes: {
          dns_lookup_duration_us: 1000,
          dns_lookup_start_us: 0,
          tcp_connection_duration_us: 2000,
          tcp_connection_start_us: 1000,
          tls_handshake_duration_us: 3000,
          tls_handshake_start_us: 3000,
          send_request_duration_us: 500,
          send_request_start_us: 6000,
          time_to_first_byte_duration_us: 10000,
          time_to_first_byte_start_us: 6500,
          receive_response_duration_us: 1500,
          receive_response_start_us: 16500,
        },
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
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

      // Nodes should be sorted chronologically
      const sortedChildren = [...node.children].sort(
        (a, b) => (a.startTimestamp ?? 0) - (b.startTimestamp ?? 0)
      );

      expect(sortedChildren).toHaveLength(6);

      sortedChildren.forEach((child, index) => {
        expect(child).toBeInstanceOf(UptimeCheckTimingNode);
        expect(child.op).toBe(expectedOps[index]);
        expect(child.description).toBe(expectedDescriptions[index]);
        expect((child as UptimeCheckTimingNode).value.event_type).toBe(
          'uptime_check_timing'
        );
        expect((child as UptimeCheckTimingNode).value.event_id).toBeDefined();
      });
    });

    it('should calculate correct space bounds for timing nodes', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-1',
        additional_attributes: {
          dns_lookup_duration_us: 5000,
          dns_lookup_start_us: 1000,
        },
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
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

  describe('getter methods', () => {
    it('should return correct description with otel-friendly UI enabled', () => {
      const extra = createMockExtra({
        organization: OrganizationFixture({
          features: ['performance-otel-friendly-ui'],
        }),
      });
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        name: 'Health Check API',
        description: 'Monitors API endpoint health',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.description).toBe('Health Check API');
    });

    it('should return correct description with otel-friendly UI disabled', () => {
      const extra = createMockExtra({
        organization: OrganizationFixture({
          features: [], // No otel-friendly UI
        }),
      });
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        name: 'Health Check API',
        description: 'Monitors API endpoint health',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.description).toBe('Monitors API endpoint health');
    });

    it('should return correct drawerTabsTitle', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        op: 'uptime_check',
        description: 'API Health Check',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.drawerTabsTitle).toBe('uptime_check - API Health Check');
    });

    it('should return correct drawerTabsTitle without description', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        op: 'uptime_check',
        description: undefined,
        // No description
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.drawerTabsTitle).toBe('uptime_check');
    });

    it('should return correct traceHeaderTitle', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        additional_attributes: {
          method: 'GET',
          request_url: 'https://api.example.com/health',
        },
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'Uptime Monitor Check',
        subtitle: 'GET https://api.example.com/health',
      });
    });

    it('should handle missing method and request_url', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        additional_attributes: {},
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'Uptime Monitor Check',
        subtitle: 'undefined undefined',
      });
    });
  });

  describe('abstract method implementations', () => {
    it('should return correct pathToNode', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-123',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      const path = node.pathToNode();
      expect(path).toEqual(['uptime-check-uptime-check-123']);
    });

    it('should return correct analyticsName', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({});

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.analyticsName()).toBe('uptime check');
    });

    it('should return correct printNode', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-456',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.printNode()).toBe('uptime check uptime-check-456');
    });

    it('should render waterfall row', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({});

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

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
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({});

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

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
    it('should match by operation', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        op: 'uptime_check',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.matchWithFreeText('uptime')).toBe(true);
      expect(node.matchWithFreeText('check')).toBe(true);
      expect(node.matchWithFreeText('uptime_check')).toBe(true);
    });

    it('should match by description', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        op: 'uptime_check',
        description: 'API Health Monitor',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.matchWithFreeText('API')).toBe(true);
      expect(node.matchWithFreeText('Health')).toBe(true);
      expect(node.matchWithFreeText('Monitor')).toBe(true);
      expect(node.matchWithFreeText('Health Monitor')).toBe(true);
    });

    it('should match by id', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-789',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.matchWithFreeText('uptime-check-789')).toBe(true);
    });

    it('should not match when query does not exist', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        op: 'uptime_check',
        description: 'API Health Monitor',
        event_id: 'uptime-check-789',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.matchWithFreeText('nonexistent')).toBe(false);
      expect(node.matchWithFreeText('database')).toBe(false);
    });

    it('should handle undefined values gracefully', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        // op might be undefined
        // description might be undefined
        event_id: 'uptime-check-999',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      // Should still match by ID
      expect(node.matchWithFreeText('uptime-check-999')).toBe(true);
      // Should not match undefined values
      expect(node.matchWithFreeText('undefined')).toBe(false);
    });

    it('should be case sensitive', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        op: 'uptime_check',
        description: 'API Health Monitor',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.matchWithFreeText('API')).toBe(true);
      expect(node.matchWithFreeText('api')).toBe(false); // Different case
      expect(node.matchWithFreeText('UPTIME')).toBe(false); // Different case
      expect(node.matchWithFreeText('uptime')).toBe(true);
    });
  });

  describe('makeBarColor', () => {
    it('should return color based on operation', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        op: 'uptime_check',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

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

    it('should handle different operations', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const theme = ThemeFixture();

      const operations = ['uptime_check', 'http.request', 'custom.op'];

      operations.forEach(op => {
        const uptimeValue = makeUptimeCheck({op});
        const parentNode = new EapSpanNode(null, parentValue, extra);
        const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

        const color = node.makeBarColor(theme);
        expect(color).toBeDefined();
        expect(typeof color).toBe('string');
      });
    });
  });

  describe('node behavior', () => {
    it('should inherit base node properties', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({});

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.errors).toBeInstanceOf(Set);
      expect(node.occurrences).toBeInstanceOf(Set);
      expect(node.profiles).toBeInstanceOf(Set);
      expect(node.canFetchChildren).toBe(false);
      expect(node.fetchStatus).toBe('idle');
      expect(node.hasFetchedChildren).toBe(false);
      expect(node.canAutogroup).toBe(false);
      expect(node.allowNoInstrumentationNodes).toBe(false);
    });

    it('should have correct directChildren and visibleChildren', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        additional_attributes: {
          dns_lookup_duration_us: 1000,
          tcp_connection_duration_us: 2000,
        },
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.directChildren).toHaveLength(6);
      expect(node.directChildren).toEqual(node.children);

      // Assuming expanded is true by default for uptime checks
      expect(node.visibleChildren).toHaveLength(6);
      expect(node.visibleChildren).toEqual(node.children);
    });

    it('should handle space calculation from base node', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        start_timestamp: 1000,
        end_timestamp: 2000,
        duration: 1,
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      // Should inherit space calculation from BaseNode
      expect(node.space).toBeDefined();
      expect(Array.isArray(node.space)).toBe(true);
      expect(node.space).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle timing nodes with zero durations', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        additional_attributes: {
          dns_lookup_duration_us: 0,
          dns_lookup_start_us: 0,
          tcp_connection_duration_us: 0,
          tcp_connection_start_us: 0,
        },
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      expect(node.children).toHaveLength(6);
      node.children.forEach(child => {
        expect(child).toBeInstanceOf(UptimeCheckTimingNode);
        expect((child as UptimeCheckTimingNode).value.duration).toBeGreaterThanOrEqual(0);
        expect(
          (child as UptimeCheckTimingNode).value.start_timestamp
        ).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle string values in additional_attributes', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        additional_attributes: {
          dns_lookup_duration_us: '5000', // String instead of number
          tcp_connection_start_us: '1000',
          method: 'POST',
          request_url: 'https://api.test.com',
        },
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      const dnsNode = node.children.find(
        child => child.op === 'dns.lookup.duration'
      ) as UptimeCheckTimingNode;

      expect(dnsNode?.value.duration).toBe(0.005); // Should convert string to number
      expect(node.traceHeaderTitle.subtitle).toBe('POST https://api.test.com');
    });

    it('should maintain consistent behavior across method calls', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const uptimeValue = makeUptimeCheck({
        event_id: 'uptime-check-consistent',
        op: 'uptime_check',
        description: 'Consistent test',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new UptimeCheckNode(parentNode, uptimeValue, extra);

      // Multiple calls should return consistent results
      expect(node.printNode()).toBe('uptime check uptime-check-consistent');
      expect(node.printNode()).toBe('uptime check uptime-check-consistent');

      expect(node.analyticsName()).toBe('uptime check');
      expect(node.analyticsName()).toBe('uptime check');

      expect(node.pathToNode()).toEqual(['uptime-check-uptime-check-consistent']);
      expect(node.pathToNode()).toEqual(['uptime-check-uptime-check-consistent']);

      expect(node.matchWithFreeText('uptime')).toBe(true);
      expect(node.matchWithFreeText('uptime')).toBe(true);
    });
  });
});
