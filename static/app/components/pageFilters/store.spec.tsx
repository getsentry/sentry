import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import {
  updateDateTime,
  updateEnvironments,
  updatePersistence,
  updateProjects,
} from 'sentry/components/pageFilters/actions';
import {PageFilterAdjustmentReason} from 'sentry/components/pageFilters/adjustments';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';

jest.mock('sentry/utils/localStorage', () => ({
  getItem: () => JSON.stringify({projects: [5], environments: ['staging']}),
  setItem: jest.fn(),
}));

describe('PageFiltersStore', () => {
  beforeEach(() => {
    PageFiltersStore.init();
  });
  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('getState()', () => {
    expect(PageFiltersStore.getState()).toEqual({
      isReady: false,
      shouldPersist: true,
      pinnedFilters: new Set(),
      adjustments: {},
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

  it('updateProjects()', async () => {
    expect(PageFiltersStore.getState().selection.projects).toEqual([]);
    updateProjects([1]);
    await tick();
    expect(PageFiltersStore.getState().selection.projects).toEqual([1]);
  });

  it('does not update if projects has same value', async () => {
    const triggerSpy = jest.spyOn(PageFiltersStore, 'trigger');
    PageFiltersStore.updateProjects([1], []);

    await waitFor(() => PageFiltersStore.getState().selection.projects[0] === 1);
    PageFiltersStore.updateProjects([1], []);
    await tick();
    expect(triggerSpy).toHaveBeenCalledTimes(1);
  });

  it('updateDateTime()', async () => {
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

  it('does not update if datetime has same value', async () => {
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

  it('updateEnvironments()', async () => {
    expect(PageFiltersStore.getState().selection.environments).toEqual([]);
    updateEnvironments(['alpha']);
    await tick();
    expect(PageFiltersStore.getState().selection.environments).toEqual(['alpha']);
  });

  it('does not update if environments has same value', async () => {
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

  it('updatePersistence()', async () => {
    expect(PageFiltersStore.getState().shouldPersist).toBe(true);
    updatePersistence(false);
    await tick();
    expect(PageFiltersStore.getState().shouldPersist).toBe(false);
  });

  describe('adjustments', () => {
    const projectAdjustment = {
      reason: PageFilterAdjustmentReason.NO_MEMBER_PROJECTS,
    } as const;
    const environmentAdjustment = {
      reason: PageFilterAdjustmentReason.INVALID_ENVIRONMENTS,
    } as const;
    const datetimeAdjustment = {
      reason: PageFilterAdjustmentReason.MAX_PICKABLE_DAYS,
      days: 30,
    } as const;

    function initializeWithAdjustments() {
      PageFiltersStore.onInitializeUrlState(PageFiltersFixture(), true, {
        projects: projectAdjustment,
        datetime: datetimeAdjustment,
      });
    }

    it('stores adjustments passed to onInitializeUrlState()', () => {
      initializeWithAdjustments();
      expect(PageFiltersStore.getState().adjustments).toEqual({
        projects: projectAdjustment,
        datetime: datetimeAdjustment,
      });
    });

    it('clears only the project adjustment when projects change', async () => {
      initializeWithAdjustments();
      PageFiltersStore.updateProjects([1], null);
      await tick();
      expect(PageFiltersStore.getState().adjustments).toEqual({
        datetime: datetimeAdjustment,
      });
    });

    it('clears the environment adjustment when projects change with environments', async () => {
      PageFiltersStore.onInitializeUrlState(PageFiltersFixture(), true, {
        environments: environmentAdjustment,
        datetime: datetimeAdjustment,
      });
      PageFiltersStore.updateProjects([1], ['prod']);
      await tick();
      expect(PageFiltersStore.getState().adjustments).toEqual({
        datetime: datetimeAdjustment,
      });
    });

    it('clears only the datetime adjustment when the date changes', async () => {
      initializeWithAdjustments();
      PageFiltersStore.updateDateTime({
        period: '7d',
        start: null,
        end: null,
        utc: null,
      });
      await tick();
      expect(PageFiltersStore.getState().adjustments).toEqual({
        projects: projectAdjustment,
      });
    });

    it('clears only the environment adjustment when environments change', async () => {
      PageFiltersStore.onInitializeUrlState(PageFiltersFixture(), true, {
        environments: environmentAdjustment,
        projects: projectAdjustment,
      });
      PageFiltersStore.updateEnvironments(['prod']);
      await tick();
      expect(PageFiltersStore.getState().adjustments).toEqual({
        projects: projectAdjustment,
      });
    });

    it('addAdjustment() records an adjustment made after initialization', async () => {
      PageFiltersStore.onInitializeUrlState(PageFiltersFixture(), true, {});
      PageFiltersStore.addAdjustment('datetime', datetimeAdjustment);
      await tick();
      expect(PageFiltersStore.getState().adjustments).toEqual({
        datetime: datetimeAdjustment,
      });
    });

    it('addAdjustment() replaces the adjustment already recorded for that filter', async () => {
      initializeWithAdjustments();
      PageFiltersStore.addAdjustment('datetime', {
        reason: PageFilterAdjustmentReason.MAX_DATE_RANGE,
        days: 7,
      });
      await tick();
      expect(PageFiltersStore.getState().adjustments).toEqual({
        projects: projectAdjustment,
        datetime: {reason: PageFilterAdjustmentReason.MAX_DATE_RANGE, days: 7},
      });
    });

    it('addAdjustment() ignores a repeat of the adjustment already recorded', async () => {
      initializeWithAdjustments();
      await tick();

      const stateBefore = PageFiltersStore.getState();
      PageFiltersStore.addAdjustment('datetime', datetimeAdjustment);
      await tick();

      // The repeat is dropped, leaving the state reference untouched.
      expect(Object.is(stateBefore, PageFiltersStore.getState())).toBe(true);
    });
  });
});
