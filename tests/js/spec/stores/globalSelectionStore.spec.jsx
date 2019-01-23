import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import {
  updateProjects,
  updateDateTime,
  updateEnvironments,
} from 'app/actionCreators/globalSelection';

jest.mock('app/utils/localStorage', () => {
  return {
    getItem: () => JSON.stringify({projects: [2], environments: ['staging']}),
    setItem: jest.fn(),
  };
});

describe('GlobalSelectionStore', function() {
  it('get()', function() {
    expect(GlobalSelectionStore.get()).toEqual({
      projects: [],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: true},
    });
  });

  it('updateProjects()', async function() {
    expect(GlobalSelectionStore.get().projects).toEqual([]);
    updateProjects([1]);
    await tick();
    expect(GlobalSelectionStore.get().projects).toEqual([1]);
  });

  it('updateDateTime()', async function() {
    expect(GlobalSelectionStore.get().datetime.period).toEqual('14d');
    updateDateTime({period: '2h', start: null, end: null});
    await tick();
    expect(GlobalSelectionStore.get().datetime.period).toEqual('2h');
    updateDateTime({
      period: null,
      start: '2018-08-08T00:00:00',
      end: '2018-09-08T00:00:00',
    });
  });

  it('updateEnvironments()', async function() {
    expect(GlobalSelectionStore.get().environments).toEqual([]);
    updateEnvironments(['alpha']);
    await tick();
    expect(GlobalSelectionStore.get().environments).toEqual(['alpha']);
  });

  it('loadInitialData() - queryParams', async function() {
    GlobalSelectionStore.loadInitialData({project: ['2'], environment: ['staging']});

    await tick();

    expect(GlobalSelectionStore.get().projects).toEqual([2]);
    expect(GlobalSelectionStore.get().environments).toEqual(['staging']);
  });

  it('loadInitialData() - localStorage', async function() {
    GlobalSelectionStore.loadInitialData({});
    await tick();

    expect(GlobalSelectionStore.get().projects).toEqual([2]);
    expect(GlobalSelectionStore.get().environments).toEqual(['staging']);
  });
});
