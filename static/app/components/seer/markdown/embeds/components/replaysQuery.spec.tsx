import {getEmbedLinkHref} from './resourceEmbedTestUtils';

describe('replays query embed', () => {
  it('builds a replays query', () => {
    const href = getEmbedLinkHref('replaysQuery', 'Replay search', {
      query: 'count_rage_clicks:>0',
      statsPeriod: '7d',
    });

    expect(href).toContain('/organizations/org-slug/explore/replays/');
    expect(href).toContain('query=count_rage_clicks%3A%3E0');
    expect(href).toContain('statsPeriod=7d');
  });
});
