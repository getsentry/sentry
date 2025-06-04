import {waitFor} from 'sentry-test/reactTestingLibrary';

import {
  pinFilter,
  updateDateTime,
  updateEnvironments,
  updatePersistence,
  updateProjects,
} from 'sentry/actionCreators/pageFilters';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';

jest.mock('sentry/utils/localStorage', () => ({
  getItem: () => JSON.stringify({projects: [5], environments: ['staging']}),
  setItem: jest.fn(),
}));

describe('PageFiltersStore', function () {
  beforeEach(() => {
    PageFiltersStore.init();
  });
  afterEach(function () {
    PageFiltersStore.reset();
  });

  it('getState()', function () {
    expect(PageFiltersStore.getState()).toEqual({
      isReady: false,
      shouldPersist: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      selection: {
        projects: [],
        environments: [],
        datetime: {period: '14d', start: null, end: null, utc: null},
      },
    });
  });

  it('returns a stable reference with getState', () => {
    PageFiltersStore.updateProjects([1], []);
    const state = PageFiltersStore.getState();
    expect(Object.is(state, PageFiltersStore.getState())).toBe(true);
  });

  it('updateProjects()', async function () {
    expect(PageFiltersStore.getState().selection.projects).toEqual([]);
    updateProjects([1]);
    await tick();
    expect(PageFiltersStore.getState().selection.projects).toEqual([1]);
  });

  it('does not update if projects has same value', async function () {
    const triggerSpy = jest.spyOn(PageFiltersStore, 'trigger');
    PageFiltersStore.updateProjects([1], []);

    await waitFor(() => PageFiltersStore.getState().selection.projects[0] === 1);
    PageFiltersStore.updateProjects([1], []);
    await tick();
    expect(triggerSpy).toHaveBeenCalledTimes(1);
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
      utc: null,
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

  it('does not update if datetime has same value', async function () {
    const now = Date.now();
    const start = new Date(now);
    const end = new Date(now + 1000);

    const triggerSpy = jest.spyOn(PageFiltersStore, 'trigger');
    PageFiltersStore.updateDateTime({end, start, period: null, utc: null});

    await waitFor(() => PageFiltersStore.getState().selection.datetime.start === start);

    PageFiltersStore.updateDateTime({
      end: new Date(end.getTime()),
      start: new Date(start.getTime()),
      period: null,
      utc: null,
    });
    await tick();

    expect(triggerSpy).toHaveBeenCalledTimes(1);
  });

  it('updateEnvironments()', async function () {
    expect(PageFiltersStore.getState().selection.environments).toEqual([]);
    updateEnvironments(['alpha']);
    await tick();
    expect(PageFiltersStore.getState().selection.environments).toEqual(['alpha']);
  });

  it('does not update if environments has same value', async function () {
    PageFiltersStore.updateEnvironments(['alpha']);
    const triggerSpy = jest.spyOn(PageFiltersStore, 'trigger');
    await waitFor(
      () => PageFiltersStore.getState().selection.environments[0] === 'alpha'
    );
    expect(triggerSpy).toHaveBeenCalledTimes(1);
    PageFiltersStore.updateEnvironments(['alpha']);
    await tick();
    expect(triggerSpy).toHaveBeenCalledTimes(1);
  });

  it('updatePersistence()', async function () {
    expect(PageFiltersStore.getState().shouldPersist).toBe(true);
    updatePersistence(false);
    await tick();
    expect(PageFiltersStore.getState().shouldPersist).toBe(false);
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
