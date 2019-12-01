import GlobalSelectionProjectsStore from 'app/stores/globalSelectionProjectsStore';
import GlobalSelectionProjectActions from 'app/actions/globalSelectionProjectActions';

describe('GlobalSelectionProjectsStore', function() {
  beforeEach(function() {
    GlobalSelectionProjectsStore.reset();
  });

  it('starts with loading state', function() {
    expect(GlobalSelectionProjectsStore.get()).toMatchObject({
      projects: [],
      error: null,
      initiallyLoaded: false,
      fetching: false,
      dirty: false,
      hasMore: false,
    });
  });

  it('updates correctly', async function() {
    const project1 = TestStubs.Project();
    // initiate fetching state
    GlobalSelectionProjectActions.fetchSelectorProjects();
    // await for action to be dispatched
    await tick();
    expect(GlobalSelectionProjectsStore.get()).toMatchObject({
      projects: [],
      error: null,
      initiallyLoaded: false,
      fetching: true,
      dirty: false,
      hasMore: false,
    });
    // initiate loading an initial project into global selection
    GlobalSelectionProjectActions.fetchSelectorProjectsSuccess([project1], false);
    // await for action to be dispatched
    await tick();
    expect(GlobalSelectionProjectsStore.get()).toMatchObject({
      projects: [project1],
      error: null,
      initiallyLoaded: true,
      fetching: false,
      dirty: false,
      hasMore: false,
    });
    // initiate loading another project into global selection
    const project2 = TestStubs.Project();
    GlobalSelectionProjectActions.fetchSelectorProjectsSuccess([project1], false);
    // await for action to be dispatched
    await tick();
    expect(GlobalSelectionProjectsStore.get()).toMatchObject({
      projects: [project1, project2],
      error: null,
      initiallyLoaded: true,
      fetching: false,
      dirty: false,
      hasMore: false,
    });
  });
});
