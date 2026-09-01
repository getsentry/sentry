import {getEmbedLinkHref} from './resourceEmbedTestUtils';

describe('logs query embed', () => {
  it('builds a logs query using the logs-prefixed params', () => {
    const href = getEmbedLinkHref('logsQuery', 'Error logs', {
      query: 'severity:error',
      mode: 'samples',
      statsPeriod: '24h',
      title: 'Error logs',
    });

    expect(href).toContain('/organizations/org-slug/explore/logs/');
    expect(href).toContain('logsQuery=severity%3Aerror');
    expect(href).toContain('mode=samples');
  });
});
