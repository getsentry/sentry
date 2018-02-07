import Reflux from 'reflux';

const GuideStore = Reflux.createStore({
  init() {
    this.data = {
      guides: [], // All guides returned to us from the server
      anchors: [], // All anchors that have been registered on this current view
      currentGuide: null, // The "on deck" guide
      currentStep: null, // The current step. If empty, it means the current guide is not active (even it cued)
    };
    // All available guides.
    // We record guides seen on the server, but immediately after a user completes a guide
    // it may not have been synced to the server, so the local copy helps in filtering correctly.
    // this.guidesSeen: new Set(),
    // The 0-based index of the current step of the current guide.
    // Null if the drawer is not open.
    // currentStep: null,
  },

  updateApplicableGuides() {
    if (!this.data.guides) {
      return null;
    }
    let available_targets = this.data.anchors.map(a => a.props.target);
    let applicable_guides = [];
    for (let i in this.data.guides) {
      let guide = this.data.guides[i];
      if (guide.required_targets.every(t => available_targets.indexOf(t) >= 0)) {
        applicable_guides.push(guide);
      }
    }

    if (applicable_guides) {
      this.data.currentGuide = applicable_guides[0];
      return applicable_guides[0];
    }

    return null;
  },

  registerAnchor(anchor) {
    this.data.anchors.push(anchor);
    this.updateApplicableGuides();
    this.trigger(this.data);
  },

  unregisterAnchor(anchor) {
    this.data.anchors.pop(this.data.anchors.indexOf(anchor));
    this.updateApplicableGuides();
    this.trigger(this.data);
  },

  load(guides) {
    this.data.guides = guides;
    this.updateApplicableGuides();
    this.trigger(this.data);
  },

  setGuide(guide) {
    this.data.currentGuide = guide;
    this.data.step = 0;
    this.trigger(this.data);
  },

  unSetGuide(guide) {
    this.data.currentGuide = '';
    this.data.currentStep = -1;
    this.trigger(this.data);
  },

  getCurrentGuide() {
    return this.data.currentGuide;
  },

  getStep() {
    return this.data.currentStep;
  },

  setStep(step) {
    this.data.step = step;
    this.trigger(this.data);
  },
});

export default GuideStore;
