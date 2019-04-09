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
      datetime: {period: null, start: null, end: null, utc: null},
    });
  });

  it('updateProjects()', async function() {
    expect(GlobalSelectionStore.get().projects).toEqual([]);
    updateProjects([1]);
    await tick();
    expect(GlobalSelectionStore.get().projects).toEqual([1]);
  });

  it('updateDateTime()', async function() {
    expect(GlobalSelectionStore.get().datetime).toEqual({
      period: null,
      start: null,
      end: null,
      utc: null,
    });
    updateDateTime({period: '2h', start: null, end: null});
    await tick();
    expect(GlobalSelectionStore.get().datetime).toEqual({
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
    expect(GlobalSelectionStore.get().datetime).toEqual({
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
    expect(GlobalSelectionStore.get().datetime).toEqual({
      period: null,
      start: null,
      end: null,
      utc: null,
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
