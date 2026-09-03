import {getEmbedLinkHref} from './resourceEmbedTestUtils';

describe('errors query embed', () => {
  it('builds an errors query with columns and a sort', () => {
    const href = getEmbedLinkHref('errorsQuery', 'Checkout errors', {
      query: 'event.type:error',
      fields: ['title', 'count()'],
      sort: '-count',
      statsPeriod: '24h',
      title: 'Checkout errors',
    });

    expect(href).toContain('/explore/discover/results/');
    expect(href).toContain('query=event.type%3Aerror');
    expect(href).toContain('field=title');
    expect(href).toContain('field=count%28%29');
    expect(href).toContain('sort=-count');
  });
});
