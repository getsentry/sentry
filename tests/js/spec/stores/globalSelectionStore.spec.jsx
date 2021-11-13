import {
  updateDateTime,
  updateEnvironments,
  updateProjects,
} from 'app/actionCreators/globalSelection';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';

jest.mock('app/utils/localStorage', () => ({
  getItem: () => JSON.stringify({projects: [5], environments: ['staging']}),
  setItem: jest.fn(),
}));

describe('GlobalSelectionStore', function () {
  afterEach(function () {
    GlobalSelectionStore.reset();
  });

  it('getState()', function () {
    expect(GlobalSelectionStore.getState()).toEqual({
      isReady: false,
      selection: {
        projects: [],
        environments: [],
        datetime: {period: '14d', start: null, end: null, utc: null},
      },
    });
  });

  it('updateProjects()', async function () {
    expect(GlobalSelectionStore.getState().selection.projects).toEqual([]);
    updateProjects([1]);
    await tick();
    expect(GlobalSelectionStore.getState().selection.projects).toEqual([1]);
  });

  it('updateDateTime()', async function () {
    expect(GlobalSelectionStore.getState().selection.datetime).toEqual({
      period: '14d',
      start: null,
      end: null,
      utc: null,
    });
    updateDateTime({period: '2h', start: null, end: null});
    await tick();
    expect(GlobalSelectionStore.getState().selection.datetime).toEqual({
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
    expect(GlobalSelectionStore.getState().selection.datetime).toEqual({
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
    expect(GlobalSelectionStore.getState().selection.datetime).toEqual({
      period: null,
      start: null,
      end: null,
      utc: null,
    });
  });

  it('updateEnvironments()', async function () {
    expect(GlobalSelectionStore.getState().selection.environments).toEqual([]);
    updateEnvironments(['alpha']);
    await tick();
    expect(GlobalSelectionStore.getState().selection.environments).toEqual(['alpha']);
  });
});
