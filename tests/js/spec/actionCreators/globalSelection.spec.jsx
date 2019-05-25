import {updateProjects} from 'app/actionCreators/globalSelection';
import GlobalSelectionActions from 'app/actions/globalSelectionActions';

describe('GlobalSelection ActionCreators', function() {
  let updateProjectsMock;
  beforeEach(function() {
    updateProjectsMock = GlobalSelectionActions.updateProjects = jest.fn();
  });

  describe('updateProjects()', function() {
    it('updates', function() {
      updateProjects([1, 2]);
      expect(updateProjectsMock).toHaveBeenCalledWith([1, 2]);
    });

    it('does not update invalid projects', function() {
      updateProjects(['1']);
      expect(updateProjectsMock).not.toHaveBeenCalled();
    });
  });

  describe('updateEnvironments()', function() {});
});
