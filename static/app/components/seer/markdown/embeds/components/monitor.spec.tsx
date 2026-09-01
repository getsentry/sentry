import {getEmbedLinkHref} from './resourceEmbedTestUtils';

describe('monitor embed', () => {
  it('links a monitor to its detector detail page', () => {
    expect(
      getEmbedLinkHref('monitor', 'nightly-sync', {id: '9931', name: 'nightly-sync'})
    ).toBe('/organizations/org-slug/monitors/9931/');
  });
});
