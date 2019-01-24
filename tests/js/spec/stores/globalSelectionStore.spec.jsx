import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import {
  updateProjects,
  updateDateTime,
  updateEnvironments,
} from 'app/actionCreators/globalSelection';

jest.mock('app/utils/localStorage', () => {
  return {
    getItem: () => JSON.stringify({projects: [5], environments: ['staging']}),
    setItem: jest.fn(),
  };
});

describe('GlobalSelectionStore', function() {
  const organization = TestStubs.Organization({
    features: ['global-views'],
    projects: [TestStubs.Project({id: '5'})],
  });

  afterEach(function() {
    GlobalSelectionStore.reset();
  });

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
    GlobalSelectionStore.loadInitialData(organization, {
      project: '5',
      environment: ['staging'],
    });

    await tick();

    expect(GlobalSelectionStore.get().projects).toEqual([5]);
    expect(GlobalSelectionStore.get().environments).toEqual(['staging']);
  });

  it('loadInitialData() - localStorage', async function() {
    GlobalSelectionStore.loadInitialData(organization, {});
    await tick();

    expect(GlobalSelectionStore.get().projects).toEqual([5]);
    expect(GlobalSelectionStore.get().environments).toEqual(['staging']);
  });

  it('loadInitialData() - defaults used if invalid', async function() {
    GlobalSelectionStore.loadInitialData(organization, {project: [2]});
    await tick();

    expect(GlobalSelectionStore.get().projects).toEqual([]);
    expect(GlobalSelectionStore.get().environments).toEqual([]);
  });
});
