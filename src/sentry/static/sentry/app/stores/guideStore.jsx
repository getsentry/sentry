import {browserHistory} from 'react-router';
import Reflux from 'reflux';
import GuideActions from 'app/actions/guideActions';
import OrganizationsActions from 'app/actions/organizationsActions';
import ProjectActions from 'app/actions/projectActions';
import {Client} from 'app/api';
import ConfigStore from 'app/stores/configStore';
import {trackAnalyticsEvent} from 'app/utils/analytics';

const GuideStore = Reflux.createStore({
  init() {
    this.state = {
      // All guides returned to us from the server.
      guides: {},
      // All anchors that are currently mounted.
      anchors: new Set(),
      // The "on deck" guide.
      currentGuide: null,
      // Current step of the current guide (0-indexed).
      currentStep: 0,
      // Current organization.
      org: null,
      // Current project.
      project: null,
      // We force show a guide if the URL contains #assistant.
      forceShow: false,
      // The previously shown guide.
      prevGuide: null,
    };

    this.api = new Client();
    this.listenTo(GuideActions.fetchSucceeded, this.onFetchSucceeded);
    this.listenTo(GuideActions.closeGuide, this.onCloseGuide);
    this.listenTo(GuideActions.nextStep, this.onNextStep);
    this.listenTo(GuideActions.registerAnchor, this.onRegisterAnchor);
    this.listenTo(GuideActions.unregisterAnchor, this.onUnregisterAnchor);
    this.listenTo(OrganizationsActions.setActive, this.onSetActiveOrganization);
    this.listenTo(ProjectActions.setActive, this.onSetActiveProject);
    this.listenTo(OrganizationsActions.changeSlug, this.onChangeOrgSlug);

    window.addEventListener('load', this.onURLChange, false);
    browserHistory.listen(() => this.onURLChange());
  },

  onURLChange() {
    this.state.forceShow = window.location.hash === '#assistant';
    this.updateCurrentGuide();
  },

  onSetActiveOrganization(data) {
    this.state.org = data;
    this.updateCurrentGuide();
  },

  onSetActiveProject(data) {
    this.state.project = data;
    this.updateCurrentGuide();
  },

  onChangeOrgSlug(_prev, next) {
    this.state.org = next;
    this.updateCurrentGuide();
  },

  onFetchSucceeded(data) {
    // It's possible we can get empty responses (seems to be Firefox specific)
    // Do nothing if `data` is empty
    if (!data) {
      return;
    }

    this.state.guides = data;
    this.updateCurrentGuide();
  },

  onCloseGuide() {
    const {currentGuide} = this.state;
    this.state.guides[
      Object.keys(this.state.guides).find(key => {
        return this.state.guides[key].id === currentGuide.id;
      })
    ].seen = true;
    // Don't continue to force show if the user dismissed the guide.
    this.state.forceShow = false;
    this.updateCurrentGuide();
  },

  onNextStep() {
    this.state.currentStep += 1;
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

  recordCue(id) {
    const data = {
      eventKey: 'assistant.guide_cued',
      eventName: 'Assistant Guide Cued',
      guide: id,
    };
    if (this.state.org) {
      data.organization_id = this.state.org.id;
    }
    trackAnalyticsEvent(data);
  },

  updatePrevGuide(bestGuide) {
    if (!bestGuide) {
      return;
    }

    if (!this.state.prevGuide || this.state.prevGuide.id !== bestGuide.id) {
      this.recordCue(bestGuide.id);
      this.state.prevGuide = bestGuide;
    }
  },

  updateCurrentGuide() {
    // Logic to determine if a guide is shown:
    // 1. If any required target is missing, don't show the guide.
    // 2. If the URL ends with #assistant, show the guide.
    // 3. If the user has seen the guide or is an old non-superuser, don't show the guide.
    // 4. Otherwise show the guide.

    const availableTargets = [...this.state.anchors].map(a => a.props.target);

    // sort() so that we pick a guide deterministically every time this function is called.
    let guideKeys = Object.keys(this.state.guides)
      .sort()
      .filter(key => {
        return this.state.guides[key].required_targets.every(
          t => availableTargets.indexOf(t) >= 0
        );
      });

    if (!this.state.forceShow) {
      const user = ConfigStore.get('user');
      guideKeys = guideKeys.filter(
        key =>
          !this.state.guides[key].seen &&
          // Don't show guides to users who signed up way before these changes were implemented
          (user.isSuperuser || new Date(user.dateJoined) > new Date(2019, 6, 1))
      );
    }

    let bestGuide = null;
    if (guideKeys.length > 0) {
      bestGuide = {
        ...this.state.guides[guideKeys[0]],

        // Remove steps that don't have an anchor on the page.
        steps: this.state.guides[guideKeys[0]].steps.filter(
          step => step.target && availableTargets.indexOf(step.target) >= 0
        ),
      };
    }

    this.updatePrevGuide(bestGuide);
    this.state.currentGuide = bestGuide;
    this.state.currentStep = 0;
    this.trigger(this.state);
  },
});

export default GuideStore;
