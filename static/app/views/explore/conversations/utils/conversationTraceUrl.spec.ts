import {getConversationTraceUrl} from './conversationTraceUrl';

describe('getConversationTraceUrl', () => {
  const trace = {traceId: 'a3805648ffffffffffffffffffffffff', spanId: 'span-1'};

  it('focuses the span and queries around its start', () => {
    expect(
      getConversationTraceUrl(
        'org-slug',
        {...trace, timestamp: 1700000000.123},
        {statsPeriod: '30d'}
      )
    ).toBe(
      '/organizations/org-slug/explore/traces/trace/a3805648ffffffffffffffffffffffff/?node=span-span-1&timestamp=1700000000.123'
    );
  });

  it('falls back to the page date range when the span has no timestamp', () => {
    expect(getConversationTraceUrl('org-slug', trace, {statsPeriod: '30d'})).toBe(
      '/organizations/org-slug/explore/traces/trace/a3805648ffffffffffffffffffffffff/?node=span-span-1&statsPeriod=30d'
    );
  });
});
