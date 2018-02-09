import Reflux from 'reflux';
import GuideActions from '../actions/guideActions';

const GuideStore = Reflux.createStore({
  init() {
    this.state = {
      // All guides returned to us from the server.
      guides: [],
      // We record guides seen on the server, but immediately after a user dismisses a guide
      // it may not have been synced yet, so the local copy helps in filtering correctly.
      guidesSeen: new Set(),
      // All anchors that have been registered on this current view.
      anchors: new Set(),
      // The "on deck" guide.
      currentGuide: null,
      // The current step of the current guide. Null if there's no guide or the guide
      // is just cued but not opened.
      currentStep: null,
    };
    this.listenTo(GuideActions.fetchSuccess, this.onFetchSuccess);
    this.listenTo(GuideActions.guideClose, this.onGuideClose);
    this.listenTo(GuideActions.nextStep, this.onNextStep);
  },

  onFetchSuccess(data) {
    this.state.guides = data;
    this.updateCurrentGuide();
  },

  onGuideClose() {
    this.state.guidesSeen.add(this.state.currentGuide.id);
    this.updateCurrentGuide();
  },

  onNextStep() {
    this.state.currentStep =
      this.state.currentStep === null ? 0 : this.state.currentStep + 1;
    this.trigger(this.state);
  },

  updateCurrentGuide() {
    let available_targets = [...this.state.anchors].map(a => a.props.target);
    let bestGuide = null;
    for (let key in this.state.guides) {
      let guide = this.state.guides[key];
      // Only show a guide if it hasn't been seen in this session before and every
      // anchor needed by the guide is on the page.
      if (
        !this.state.guidesSeen.has(guide.id) &&
        guide.required_targets.every(t => available_targets.indexOf(t) >= 0)
      ) {
        bestGuide = guide;
        break;
      }
    }
    if (bestGuide != this.state.currentGuide) {
      this.state.currentGuide = bestGuide;
      this.state.currentStep = null;
      this.trigger(this.state);
    }
  },

  registerAnchor(anchor) {
    this.state.anchors.add(anchor);
    this.updateCurrentGuide();
  },

  unregisterAnchor(anchor) {
    this.state.anchors.delete(anchor);
    this.updateCurrentGuide();
  },
});

export default GuideStore;
