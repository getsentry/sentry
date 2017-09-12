import Reflux from 'reflux';

import ProjectActions from '../actions/projectActions';

const ProjectModalStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(ProjectActions.closeDiffModal, this.onCloseDiffModal);
    this.listenTo(ProjectActions.openDiffModal, this.onOpenDiffModal);
  },

  reset() {
    this.diffModal = null;
  },

  onCloseDiffModal() {
    this.diffModal = null;
    this.trigger(this.diffModal);
  },

  onOpenDiffModal(props) {
    this.diffModal = props;
    this.trigger(this.diffModal);
  }
});

export default ProjectModalStore;
