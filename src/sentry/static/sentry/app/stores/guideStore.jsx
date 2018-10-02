import {browserHistory} from 'react-router';
import Reflux from 'reflux';
import GuideActions from 'app/actions/guideActions';
import OrganizationsActions from 'app/actions/organizationsActions';
import analytics from 'app/utils/analytics';
import ProjectActions from 'app/actions/projectActions';
import {Client} from 'app/api';
import ConfigStore from 'app/stores/configStore';

const ALERT_REMINDER_1 = 'alert_reminder_1';

const GuideStore = Reflux.createStore({
  init() {
    this.state = {
      // All guides returned to us from the server.
      guides: {},
      // All anchors that are currently mounted.
      anchors: new Set(),
      // The "on deck" guide.
      currentGuide: null,
      // Current step of the current guide (1-indexed). 0 if there's no guide
      // or the guide is just cued but not opened.
      currentStep: 0,
      // Current organization.
      org: null,
      // Current project.
      project: null,
      // We force show a guide if the URL contains #assistant.
      forceShow: false,
      // The previously shown guide.
      prevGuide: null,
      // Total events received in the project in the last 30 days. id (int) -> int.
      projectStats: new Map(),
      // Whether the project has customized alert rules. id (int) -> bool.
      projectRules: new Map(),
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

  onChangeOrgSlug(prev, next) {
    this.state.org = next;
    this.updateCurrentGuide();
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
    let data = {
      guide: id,
      cue,
    };
    if (this.state.org) {
      data.org_id = parseInt(this.state.org.id, 10);
    }
    analytics('assistant.guide_cued', data);
  },

  updatePrevGuide(bestGuide) {
    if (!bestGuide) return;

    if (!this.state.prevGuide || this.state.prevGuide.id !== bestGuide.id) {
      this.recordCue(bestGuide.id, bestGuide.cue);
      this.state.prevGuide = bestGuide;
    }
  },

  isDefaultAlert(data) {
    return (
      data.length === 1 &&
      data[0].actionMatch === 'all' &&
      data[0].frequency === 30 &&
      data[0].conditions.length === 1 &&
      data[0].conditions[0].id ===
        'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition' &&
      data[0].actions.length === 1 &&
      data[0].actions[0].id === 'sentry.rules.actions.notify_event.NotifyEventAction'
    );
  },

  async getProjectStats(projectId) {
    let {org, project, projectStats} = this.state;

    if (projectStats.has(projectId)) {
      return Promise.resolve(projectStats.get(projectId));
    }

    let path = `/projects/${org.slug}/${project.slug}/stats/`;
    return this.api
      .requestPromise(path, {
        query: {
          // Last 30 days.
          since: new Date().getTime() / 1000 - 3600 * 24 * 30,
        },
      })
      .then(data => {
        let eventsReceived = data.reduce((sum, point) => sum + point[1], 0);
        projectStats.set(projectId, eventsReceived);
        return eventsReceived;
      });
  },

  async getProjectRules(projectId) {
    let {org, project, projectRules} = this.state;

    if (projectRules.has(projectId)) {
      return Promise.resolve(projectRules.get(projectId));
    }

    let path = `/projects/${org.slug}/${project.slug}/rules/`;
    return this.api
      .requestPromise(path, {
        query: {
          // Last 30 days.
          since: new Date().getTime() / 1000 - 3600 * 24 * 30,
        },
      })
      .then(data => {
        let result = !this.isDefaultAlert(data);
        projectRules.set(projectId, result);
        return result;
      });
  },

  async checkAlertTipData() {
    // Check if we have the data needed to determine if the alert-reminder tip should be shown.
    // If not, take the necessary actions to fetch the data.
    let {org, project} = this.state;

    if (!org || !project) {
      return Promise.resolve([]);
    }

    let projectId = parseInt(project.id, 10);
    return Promise.all([
      this.getProjectStats(projectId),
      this.getProjectRules(projectId),
    ]);
  },

  async getBestGuideKey(guideKeys) {
    // Pick the first guide that satisfies conditions.
    let user = ConfigStore.get('user');

    return new Promise(async (resolve, reject) => {
      let projectData = [];

      if (guideKeys.includes(ALERT_REMINDER_1)) {
        projectData = await this.checkAlertTipData();
      }

      resolve(
        guideKeys.find(key => {
          // Pick the first guide that satisfies conditions.
          if (key === ALERT_REMINDER_1) {
            let [stats, rules] = projectData;
            return !rules && stats > 1000;
          } else if (
            user.isSuperuser ||
            new Date(user.dateJoined) > new Date(2018, 4, 10)
          ) {
            return true;
          }

          return false;
        })
      );
    });
  },

  async updateCurrentGuide() {
    // Logic to determine if a guide is shown:
    // 1. If any required target is missing, don't show the guide.
    // 2. If custom checks fail, don't show the guide.
    // 3. If the URL ends with #assistant, show the guide.
    // 4. If the user isn't in the A/B test, don't show the guide.
    // 5. If the user has seen the guide, don't show it.
    // 6. Otherwise show the guide.

    let availableTargets = [...this.state.anchors].map(a => a.props.target);

    // sort() so that we pick a guide deterministically every time this function is called.
    let guideKeys = Object.keys(this.state.guides)
      .sort()
      .filter(key => {
        return this.state.guides[key].required_targets.every(
          t => availableTargets.indexOf(t) >= 0
        );
      });

    if (!this.state.forceShow) {
      let features = ConfigStore.get('features');
      if (features && features.has('assistant')) {
        guideKeys = guideKeys.filter(key => !this.state.guides[key].seen);
      } else {
        guideKeys = [];
      }
    }

    // Pick the first guide that satisfies conditions.
    let bestGuideKey = await this.getBestGuideKey(guideKeys);

    let bestGuide = null;
    if (bestGuideKey) {
      bestGuide = {
        ...this.state.guides[bestGuideKey],

        // Remove steps that don't have an anchor on the page.
        steps: this.state.guides[bestGuideKey].steps.filter(
          step =>
            step.target === null ||
            (step.target && availableTargets.indexOf(step.target) >= 0)
        ),
      };
    }

    this.updatePrevGuide(bestGuide);
    this.state.currentGuide = bestGuide;
    this.state.currentStep =
      bestGuide && (this.state.forceShow || bestGuide.guide_type === 'tip') ? 1 : 0;
    this.trigger(this.state);
  },
});

export default GuideStore;
