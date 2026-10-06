import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {usePlaylistQuery} from 'sentry/components/replays/usePlaylistQuery';

const initialRouterConfig = {
  route: '/mock-pathname/',
  location: {pathname: '/mock-pathname/'},
};

describe('usePlaylistQuery', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2001-11-15T12:34:56.789Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('derives a playlist range when the stats period is measured in hours', () => {
    const {result} = renderHookWithProviders(usePlaylistQuery, {
      initialProps: 'replayList' as const,
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {...initialRouterConfig.location, query: {statsPeriod: '2h'}},
      },
    });

    expect(result.current).toEqual(
      expect.objectContaining({
        playlistStart: '2001-11-15T10:34:56',
        playlistEnd: '2001-11-15T12:34:56',
      })
    );
  });

  it('derives a playlist range when the stats period is unitless and so measured in seconds', () => {
    const {result} = renderHookWithProviders(usePlaylistQuery, {
      initialProps: 'replayList' as const,
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {...initialRouterConfig.location, query: {statsPeriod: '3600'}},
      },
    });

    expect(result.current).toEqual(
      expect.objectContaining({
        playlistStart: '2001-11-15T11:34:56',
        playlistEnd: '2001-11-15T12:34:56',
      })
    );
  });
});
