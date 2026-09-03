import {LocationFixture} from 'sentry-fixture/locationFixture';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  ExploreShareButton,
  getExploreShareLink,
} from 'sentry/views/explore/components/exploreShareButton';
import {TraceItemDataset} from 'sentry/views/explore/types';

jest.mock('sentry/utils/analytics');

describe('getExploreShareLink', () => {
  const now = new Date('2026-09-03T12:00:00.000Z').getTime();
  const pathname = '/organizations/org-slug/explore/logs/';
  const relative = {period: '7d', start: null, end: null, utc: null};

  it('replaces a relative period with absolute start and end when the selection is relative', () => {
    const link = getExploreShareLink({
      datetime: relative,
      location: LocationFixture({pathname, search: '?statsPeriod=7d&project=1'}),
      now,
    });

    expect(link).toEqual({
      frozenRelativePeriod: true,
      url: 'http://localhost/organizations/org-slug/explore/logs/?project=1&start=2026-08-27T12%3A00%3A00&end=2026-09-03T12%3A00%3A00',
    });
  });

  it('adds absolute start and end when the URL has no period', () => {
    const link = getExploreShareLink({
      datetime: {...relative, period: '1h'},
      location: LocationFixture({pathname, search: '?project=1'}),
      now,
    });

    expect(link.url).toBe(
      'http://localhost/organizations/org-slug/explore/logs/?project=1&start=2026-09-03T11%3A00%3A00&end=2026-09-03T12%3A00%3A00'
    );
  });

  it('strips the legacy period param when the URL uses it', () => {
    const link = getExploreShareLink({
      datetime: relative,
      location: LocationFixture({pathname, search: '?period=7d&utc=true'}),
      now,
    });

    expect(link.url).toBe(
      'http://localhost/organizations/org-slug/explore/logs/?utc=true&start=2026-08-27T12%3A00%3A00&end=2026-09-03T12%3A00%3A00'
    );
  });

  it('keeps the URL unchanged when the selection is already absolute', () => {
    const search =
      '?start=2026-08-01T00%3A00%3A00&end=2026-08-02T00%3A00%3A00&utc=true&project=1';
    const link = getExploreShareLink({
      datetime: {
        period: null,
        start: '2026-08-01T00:00:00.000',
        end: '2026-08-02T00:00:00.000',
        utc: true,
      },
      location: LocationFixture({pathname, search}),
      now,
    });

    expect(link).toEqual({
      frozenRelativePeriod: false,
      url: `http://localhost${pathname}${search}`,
    });
  });
});

describe('ExploreShareButton', () => {
  const initialRouterConfig = {
    location: {
      pathname: '/organizations/org-slug/explore/logs/',
      query: {statsPeriod: '7d', project: '1'},
    },
  };

  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '7d', start: null, end: null, utc: null},
    });
  });

  it('copies a link with a frozen time range when clicked', async () => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });
    render(<ExploreShareButton traceItemDataset={TraceItemDataset.LOGS} />, {
      initialRouterConfig,
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

  it('does not track analytics when the clipboard write fails', async () => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockRejectedValue(new Error('denied'))},
    });
    render(<ExploreShareButton traceItemDataset={TraceItemDataset.LOGS} />, {
      initialRouterConfig,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Share'}));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
    expect(trackAnalytics).not.toHaveBeenCalled();
  });
});
