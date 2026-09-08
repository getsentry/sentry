import {getEmbedLinkHref} from './resourceEmbedTestUtils';

describe('saved query embed', () => {
  it.each([
    ['spans', '/organizations/org-slug/explore/traces/?id=312'],
    ['logs', '/organizations/org-slug/explore/logs/?id=312'],
    ['metrics', '/organizations/org-slug/explore/metrics/?id=312'],
    ['replays', '/organizations/org-slug/explore/replays/?id=312'],
  ])('opens a saved %s query on its own explore surface', (dataset, expected) => {
    expect(getEmbedLinkHref('savedQuery', 'Saved query 312', {id: '312', dataset})).toBe(
      expected
    );
  });
});
