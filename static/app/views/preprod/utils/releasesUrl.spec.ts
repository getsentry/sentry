import {makeSnapshotsListUrl} from 'sentry/views/preprod/utils/releasesUrl';

describe('makeSnapshotsListUrl', () => {
  it('returns the bare list url without params', () => {
    expect(makeSnapshotsListUrl('org-slug')).toBe(
      '/organizations/org-slug/explore/snapshots/'
    );
  });

  it('includes provided params and skips empty ones', () => {
    expect(
      makeSnapshotsListUrl('org-slug', {
        project: ['1', '2'],
        query: 'app_id:com.example.app',
        statsPeriod: '7d',
        start: undefined,
        end: '',
      })
    ).toBe(
      '/organizations/org-slug/explore/snapshots/?project=1&project=2&query=app_id%3Acom.example.app&statsPeriod=7d'
    );
  });
});
