import {LocationFixture} from 'sentry-fixture/locationFixture';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  ExploreShareButton,
  getExploreShareUrl,
} from 'sentry/views/explore/components/exploreShareButton';
import {TraceItemDataset} from 'sentry/views/explore/types';

jest.mock('sentry/utils/analytics');

describe('getExploreShareUrl', () => {
  const now = new Date('2026-09-03T12:00:00.000Z');

  it('replaces a relative period with absolute start and end when the selection is relative', () => {
    const url = getExploreShareUrl({
      datetime: {period: '7d', start: null, end: null, utc: null},
      location: LocationFixture({
        pathname: '/organizations/org-slug/explore/logs/',
        search: '?statsPeriod=7d&project=1',
      }),
      now,
    });

    expect(url).toBe(
      'http://localhost/organizations/org-slug/explore/logs/?project=1&start=2026-08-27T12%3A00%3A00&end=2026-09-03T12%3A00%3A00'
    );
  });

  it('adds absolute start and end when the URL has no period', () => {
    const url = getExploreShareUrl({
      datetime: {period: '1h', start: null, end: null, utc: null},
      location: LocationFixture({
        pathname: '/organizations/org-slug/explore/logs/',
        search: '?project=1',
      }),
      now,
    });

    expect(url).toBe(
      'http://localhost/organizations/org-slug/explore/logs/?project=1&start=2026-09-03T11%3A00%3A00&end=2026-09-03T12%3A00%3A00'
    );
  });

  it('keeps the URL unchanged when the selection is already absolute', () => {
    const url = getExploreShareUrl({
      datetime: {
        period: null,
        start: '2026-08-01T00:00:00.000',
        end: '2026-08-02T00:00:00.000',
        utc: true,
      },
      location: LocationFixture({
        pathname: '/organizations/org-slug/explore/logs/',
        search:
          '?start=2026-08-01T00%3A00%3A00&end=2026-08-02T00%3A00%3A00&utc=true&project=1',
      }),
      now,
    });

    expect(url).toBe(
      'http://localhost/organizations/org-slug/explore/logs/?start=2026-08-01T00%3A00%3A00&end=2026-08-02T00%3A00%3A00&utc=true&project=1'
    );
  });
});

describe('ExploreShareButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '7d', start: null, end: null, utc: null},
    });
  });

  it('copies a link with a frozen time range when clicked', async () => {
    render(<ExploreShareButton traceItemDataset={TraceItemDataset.LOGS} />, {
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/logs/',
          query: {statsPeriod: '7d', project: '1'},
        },
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Share'}));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringMatching(
          /^http:\/\/localhost\/organizations\/org-slug\/explore\/logs\/\?project=1&start=[^&]+&end=[^&]+$/
        )
      );
    });
    expect(trackAnalytics).toHaveBeenCalledWith(
      'explore.share_link_copied',
      expect.objectContaining({
        traceItemDataset: TraceItemDataset.LOGS,
        frozen_relative_period: true,
      })
    );
  });
});
