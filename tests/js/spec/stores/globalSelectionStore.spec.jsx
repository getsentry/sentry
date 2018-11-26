import GlobalSelectionStore from 'app/stores/globalSelectionStore';

describe('GlobalSelectionStore', function() {
  it('get()', function() {
    expect(GlobalSelectionStore.get()).toEqual({projects: []});
  });

  it('updateProjects()', function() {
    expect(GlobalSelectionStore.get().projects).toEqual([]);
    GlobalSelectionStore.updateProjects([1]);
    expect(GlobalSelectionStore.get().projects).toEqual([1]);
  });
});
