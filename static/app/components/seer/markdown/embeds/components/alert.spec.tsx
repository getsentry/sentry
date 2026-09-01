import {screen} from 'sentry-test/reactTestingLibrary';

import {getEmbedLinkHref, renderEmbed} from './resourceEmbedTestUtils';

describe('alert embed', () => {
  it('points a metric alert at its detector', () => {
    expect(
      getEmbedLinkHref('alert', 'Checkout latency', {
        id: '4521',
        kind: 'metric',
        name: 'Checkout latency',
      })
    ).toBe('/organizations/org-slug/monitors/4521/');
  });

  it('points an issue alert at its automation', () => {
    expect(getEmbedLinkHref('alert', 'Alert 881', {id: '881', kind: 'issue'})).toBe(
      '/organizations/org-slug/monitors/alerts/881/'
    );
  });

  it('falls back to an id-based label when the API name is missing', () => {
    renderEmbed({name: 'alert', data: {id: '4521', kind: 'metric'}});
    expect(screen.getByRole('link', {name: 'Alert 4521'})).toBeInTheDocument();
  });
});
