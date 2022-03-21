import {
  pinFilter,
  updateDateTime,
  updateEnvironments,
  updateProjects,
} from 'sentry/actionCreators/pageFilters';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';

jest.mock('sentry/utils/localStorage', () => ({
  getItem: () => JSON.stringify({projects: [5], environments: ['staging']}),
  setItem: jest.fn(),
}));

describe('PageFiltersStore', function () {
  afterEach(function () {
    PageFiltersStore.reset();
  });

  it('getState()', function () {
    expect(PageFiltersStore.getState()).toEqual({
      isReady: false,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      selection: {
        projects: [],
        environments: [],
        datetime: {period: '14d', start: null, end: null, utc: null},
      },
    });
  });

  it('updateProjects()', async function () {
    expect(PageFiltersStore.getState().selection.projects).toEqual([]);
    updateProjects([1]);
    await tick();
    expect(PageFiltersStore.getState().selection.projects).toEqual([1]);
  });

  it('updateDateTime()', async function () {
    expect(PageFiltersStore.getState().selection.datetime).toEqual({
      period: '14d',
      start: null,
      end: null,
      utc: null,
    });
    updateDateTime({period: '2h', start: null, end: null});
    await tick();
    expect(PageFiltersStore.getState().selection.datetime).toEqual({
      period: '2h',
      start: null,
      end: null,
    });

    updateDateTime({
      period: null,
      start: '2018-08-08T00:00:00',
      end: '2018-09-08T00:00:00',
      utc: true,
    });
    await tick();
    expect(PageFiltersStore.getState().selection.datetime).toEqual({
      period: null,
      start: '2018-08-08T00:00:00',
      end: '2018-09-08T00:00:00',
      utc: true,
    });

    updateDateTime({
      period: null,
      start: null,
      end: null,
      utc: null,
    });
    await tick();
    expect(PageFiltersStore.getState().selection.datetime).toEqual({
      period: null,
      start: null,
      end: null,
      utc: null,
    });
  });

  it('updateEnvironments()', async function () {
    expect(PageFiltersStore.getState().selection.environments).toEqual([]);
    updateEnvironments(['alpha']);
    await tick();
    expect(PageFiltersStore.getState().selection.environments).toEqual(['alpha']);
  });

  it('can mark filters as pinned', async function () {
    expect(PageFiltersStore.getState().pinnedFilters).toEqual(new Set());
    pinFilter('projects', true);
    await tick();
    expect(PageFiltersStore.getState().pinnedFilters).toEqual(new Set(['projects']));

    pinFilter('environments', true);
    await tick();
    expect(PageFiltersStore.getState().pinnedFilters).toEqual(
      new Set(['projects', 'environments'])
    );

    pinFilter('projects', false);
    await tick();
    expect(PageFiltersStore.getState().pinnedFilters).toEqual(new Set(['environments']));
  });
});
