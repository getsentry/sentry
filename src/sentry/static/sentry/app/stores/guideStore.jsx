import Reflux from 'reflux';
import $ from 'jquery';
import GuideActions from '../actions/guideActions';
import HookStore from './hookStore';
import OrganizationsActions from '../actions/organizationsActions';

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
      // The current step of the current guide (1-indexed). 0 if there's no guide
      // or the guide is just cued but not opened.
      currentStep: 0,

      currentOrg: null,
    };
    this.listenTo(GuideActions.fetchSucceeded, this.onFetchSucceeded);
    this.listenTo(GuideActions.closeGuideOrSupport, this.onCloseGuideOrSupport);
    this.listenTo(GuideActions.nextStep, this.onNextStep);
    this.listenTo(GuideActions.registerAnchor, this.onRegisterAnchor);
    this.listenTo(GuideActions.unregisterAnchor, this.onUnregisterAnchor);
    this.listenTo(GuideActions.openDrawer, this.onOpenDrawer);
    this.listenTo(OrganizationsActions.setActive, this.onSetActiveOrganization);
    this.listenTo(OrganizationsActions.changeSlug, this.onChangeSlug);
  },

  onSetActiveOrganization(data) {
    this.state.currentOrg = data;
  },

  onChangeSlug(prev, next) {
    this.state.currentOrg = next;
  },

  onFetchSucceeded(data) {
    this.state.guides = data;
    this.updateCurrentGuide();
  },

  // This handles both closing a guide and the support drawer.
  onCloseGuideOrSupport() {
    let {currentGuide} = this.state;
    if (currentGuide) {
      this.state.guidesSeen.add(currentGuide.id);
    }
    this.updateCurrentGuide();
  },

  onOpenDrawer() {
    if (this.state.currentStep < 1) {
      this.state.currentStep = 1;
    }
    this.updateCurrentGuide();
  },

  onNextStep() {
    this.state.currentStep += 1;
    this.trigger(this.state);
    if (this.state.currentGuide && this.state.currentStep == 1) {
      HookStore.get('analytics:event').forEach(cb =>
        cb('assistant.guide_opened', {
          guide: this.state.currentGuide.id,
        })
      );
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

  updateCurrentGuide() {
    let availableTargets = [...this.state.anchors].map(a => a.props.target);

    // Select the first guide that hasn't been seen in this session and has all
    // required anchors on the page.
    let bestGuideKey = Object.keys(this.state.guides).find(key => {
      let guide = this.state.guides[key];
      let seen = this.state.guidesSeen.has(guide.id);
      let allTargetsPresent = guide.required_targets.every(
        t => availableTargets.indexOf(t) >= 0
      );
      return !seen && allTargetsPresent;
    });

    let bestGuide = null;
    if (bestGuideKey) {
      bestGuide = $.extend(true, {}, this.state.guides[bestGuideKey]);
      // Remove steps that don't have an anchor on the page.
      bestGuide.steps = bestGuide.steps.filter(
        step => step.target && availableTargets.indexOf(step.target) >= 0
      );
    }

    this.state.currentGuide = bestGuide;
    this.trigger(this.state);
  },
});

export default GuideStore;
