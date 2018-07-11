import Reflux from 'reflux';
import $ from 'jquery';
import GuideActions from 'app/actions/guideActions';
import OrganizationsActions from 'app/actions/organizationsActions';
import analytics from 'app/utils/analytics';
import ProjectActions from 'app/actions/projectActions';

const GuideStore = Reflux.createStore({
  init() {
    this.state = {
      // All guides returned to us from the server.
      guides: {},
      // All anchors that have been registered on this current view.
      anchors: new Set(),
      // The "on deck" guide.
      currentGuide: null,
      // The current step of the current guide (1-indexed). 0 if there's no guide
      // or the guide is just cued but not opened.
      currentStep: 0,

      currentOrg: null,

      currentProject: null,

      forceShow: false,
      prevGuide: null,
    };
    this.listenTo(GuideActions.fetchSucceeded, this.onFetchSucceeded);
    this.listenTo(GuideActions.closeGuide, this.onCloseGuide);
    this.listenTo(GuideActions.nextStep, this.onNextStep);
    this.listenTo(GuideActions.registerAnchor, this.onRegisterAnchor);
    this.listenTo(GuideActions.unregisterAnchor, this.onUnregisterAnchor);
    this.listenTo(OrganizationsActions.setActive, this.onSetActiveOrganization);
    this.listenTo(ProjectActions.setActive, this.onSetActiveProject);
    this.listenTo(OrganizationsActions.changeSlug, this.onChangeSlug);

    window.addEventListener('hashchange', this.onURLChange, false);
    window.addEventListener('load', this.onURLChange, false);
  },

  onURLChange() {
    this.state.forceShow = window.location.hash === '#assistant';
    this.updateCurrentGuide();
  },

  onSetActiveOrganization(data) {
    this.state.currentOrg = data;
    this.trigger(this.state);
  },

  onSetActiveProject(data) {
    this.state.currentProject = data;
    this.trigger(this.state);
  },

  onChangeSlug(prev, next) {
    this.state.currentOrg = next;
  },

  onFetchSucceeded(data) {
    this.state.guides = data;
    this.updateCurrentGuide();
  },

  onCloseGuide() {
    let {currentGuide} = this.state;
    this.state.guides[
      Object.keys(this.state.guides).find(key => {
        return this.state.guides[key].id == currentGuide.id;
      })
    ].seen = true;
    // Don't continue to force show if the user dismissed the guide.
    this.state.forceShow = false;
    this.updateCurrentGuide();
  },

  onNextStep() {
    this.state.currentStep += 1;
    this.trigger(this.state);
    if (this.state.currentGuide && this.state.currentStep == 1) {
      analytics('assistant.guide_opened', {
        guide: this.state.currentGuide.id,
      });
    }
  },

  onRegisterAnchor(anchor) {
    this.state.anchors.add(anchor);
    this.updateCurrentGuide();
  },

  onUnregisterAnchor(anchor) {
    this.state.anchors.delete(anchor);
    this.updateCurrentGuide();
  },

  recordCue(id, cue) {
    analytics('assistant.guide_cued', {
      guide: id,
      cue,
    });
  },

  updatePrevGuide(bestGuide) {
    if (!bestGuide) return;

    if (!this.state.prevGuide || this.state.prevGuide.id !== bestGuide.id) {
      this.recordCue(bestGuide.id, bestGuide.cue);
      this.state.prevGuide = bestGuide;
    }
  },

  updateCurrentGuide() {
    let availableTargets = [...this.state.anchors].map(a => a.props.target);

    // Select the first guide that hasn't been seen in this session and has all
    // required anchors on the page.
    // If url hash is #assistant, show the first guide regardless of seen and has
    // all required anchors.
    let bestGuideKey = Object.keys(this.state.guides).find(key => {
      let guide = this.state.guides[key];
      let allTargetsPresent = guide.required_targets.every(
        t => availableTargets.indexOf(t) >= 0
      );
      return (this.state.forceShow || !guide.seen) && allTargetsPresent;
    });

    let bestGuide = null;
    if (bestGuideKey) {
      bestGuide = $.extend(true, {}, this.state.guides[bestGuideKey]);
      // Remove steps that don't have an anchor on the page.
      bestGuide.steps = bestGuide.steps.filter(
        step =>
          step.target === null ||
          (step.target && availableTargets.indexOf(step.target) >= 0)
      );
    }
    this.updatePrevGuide(bestGuide);
    this.state.currentGuide = bestGuide;

    this.state.currentStep = this.state.forceShow ? 1 : 0;

    this.trigger(this.state);
  },
});

export default GuideStore;
