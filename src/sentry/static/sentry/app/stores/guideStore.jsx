import Reflux from 'reflux';
import GuideActions from '../actions/guideActions';

const GuideStore = Reflux.createStore({
  init() {
    this.state = {
      // All guides returned to us from the server.
      guides: {},
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
    this.listenTo(GuideActions.fetchSucceeded, this.onFetchSucceeded);
    this.listenTo(GuideActions.closeGuide, this.onCloseGuide);
    this.listenTo(GuideActions.nextStep, this.onNextStep);
    this.listenTo(GuideActions.registerAnchor, this.onRegisterAnchor);
    this.listenTo(GuideActions.unregisterAnchor, this.onUnregisterAnchor);
  },

  onFetchSucceeded(data) {
    this.state.guides = data;
    this.updateCurrentGuide();
  },

  onCloseGuide() {
    this.state.guidesSeen.add(this.state.currentGuide.id);
    this.updateCurrentGuide();
  },

  onNextStep() {
    this.state.currentStep =
      this.state.currentStep === null ? 0 : this.state.currentStep + 1;
    this.trigger(this.state);
  },

  onRegisterAnchor(anchor) {
    this.state.anchors.add(anchor);
    this.updateCurrentGuide();
  },

  onUnregisterAnchor(anchor) {
    this.state.anchors.delete(anchor);
    this.updateCurrentGuide();
  },

  updateCurrentGuide() {
    let availableTargets = [...this.state.anchors].map(a => a.props.target);
    let bestGuideKey = Object.keys(this.state.guides).find(key => {
      // Only show a guide if it hasn't been seen in this session before and every
      // anchor needed by the guide is on the page.
      let guide = this.state.guides[key];
      let seen = this.state.guidesSeen.has(guide.id);
      let allTargetsPresent = guide.required_targets.every(
        t => availableTargets.indexOf(t) >= 0
      );
      return !seen && allTargetsPresent;
    });
    let bestGuide = bestGuideKey ? this.state.guides[bestGuideKey] : null;
    if (bestGuide !== this.state.currentGuide) {
      this.state.currentGuide = bestGuide;
      this.state.currentStep = null;
      this.trigger(this.state);
    }
  },
});

export default GuideStore;
