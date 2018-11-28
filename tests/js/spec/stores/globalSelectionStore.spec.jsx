import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import {updateProjects} from 'app/actionCreators/globalSelection';

describe('GlobalSelectionStore', function() {
  it('get()', function() {
    expect(GlobalSelectionStore.get()).toEqual({projects: []});
  });

  it('updateProjects()', async function() {
    expect(GlobalSelectionStore.get().projects).toEqual([]);
    updateProjects([1]);
    await tick();
    expect(GlobalSelectionStore.get().projects).toEqual([1]);
  });
});
