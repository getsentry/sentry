import {browserHistory} from 'react-router';
import {createStore, StoreDefinition} from 'reflux';

import GuideActions from 'sentry/actions/guideActions';
import OrganizationsActions from 'sentry/actions/organizationsActions';
import getGuidesContent from 'sentry/components/assistant/getGuidesContent';
import {Guide, GuidesServerData} from 'sentry/components/assistant/types';
import ConfigStore from 'sentry/stores/configStore';
import {Organization} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import {
  cleanupActiveRefluxSubscriptions,
  makeSafeRefluxStore,
} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

/**
 * Date when the assistant came into thsi world
 */
const ASSISTANT_THRESHOLD = new Date(2019, 6, 1);

function guidePrioritySort(a: Guide, b: Guide) {
  const a_priority = a.priority ?? Number.MAX_SAFE_INTEGER;
  const b_priority = b.priority ?? Number.MAX_SAFE_INTEGER;
  if (a_priority === b_priority) {
    return a.guide.localeCompare(b.guide);
  }
  // lower number takes priority
  return a_priority - b_priority;
}

type State = {
  /**
   * Anchors that are currently mounted
   */
  anchors: Set<string>;
  /**
   * The current guide
   */
  currentGuide: Guide | null;
  /**
   * Current step of the current guide
   */
  currentStep: number;
  /**
   * Hides guides that normally would be shown
   */
  forceHide: boolean;
  /**
   * We force show a guide if the URL contains #assistant
   */
  forceShow: boolean;
  /**
   * All tooltip guides
   */
  guides: Guide[];
  /**
   * Current organization id
   */
  orgId: string | null;
  /**
   * Current organization slug
   */
  orgSlug: string | null;
  /**
   * The previously shown guide
   */
  prevGuide: Guide | null;
};

const defaultState: State = {
  guides: [],
  forceHide: false,
  anchors: new Set(),
  currentGuide: null,
  currentStep: 0,
  orgId: null,
  orgSlug: null,
  forceShow: false,
  prevGuide: null,
};

interface GuideStoreInterface extends StoreDefinition, CommonStoreDefinition<State> {
  browserHistoryListener: null | (() => void);

  onFetchSucceeded(data: GuidesServerData): void;
  onRegisterAnchor(target: string): void;
  onSetForceHide(forceHide: boolean): void;
  onUnregisterAnchor(target: string): void;
  recordCue(guide: string): void;
  state: State;
  updatePrevGuide(nextGuide: Guide | null): void;
}

const storeConfig: GuideStoreInterface = {
  state: defaultState,
  unsubscribeListeners: [],
  browserHistoryListener: null,

  init() {
    this.state = defaultState;

    this.unsubscribeListeners.push(
      this.listenTo(GuideActions.fetchSucceeded, this.onFetchSucceeded)
    );
    this.unsubscribeListeners.push(
      this.listenTo(GuideActions.closeGuide, this.onCloseGuide)
    );
    this.unsubscribeListeners.push(this.listenTo(GuideActions.nextStep, this.onNextStep));
    this.unsubscribeListeners.push(this.listenTo(GuideActions.toStep, this.onToStep));
    this.unsubscribeListeners.push(
      this.listenTo(GuideActions.registerAnchor, this.onRegisterAnchor)
    );
    this.unsubscribeListeners.push(
      this.listenTo(GuideActions.unregisterAnchor, this.onUnregisterAnchor)
    );
    this.unsubscribeListeners.push(
      this.listenTo(GuideActions.setForceHide, this.onSetForceHide)
    );
    this.unsubscribeListeners.push(
      this.listenTo(OrganizationsActions.setActive, this.onSetActiveOrganization)
    );

    window.addEventListener('load', this.onURLChange, false);
    this.browserHistoryListener = browserHistory.listen(() => this.onURLChange());
  },

  teardown() {
    cleanupActiveRefluxSubscriptions(this.unsubscribeListeners);
    window.removeEventListener('load', this.onURLChange);

    this.browserHistoryListener?.();
  },

  onURLChange() {
    const forceShow = window.location.hash === '#assistant';
    this.state = {...this.state, forceShow};
    this.updateCurrentGuide();
  },

  onSetActiveOrganization(data?: Organization) {
    this.state = {
      ...this.state,
      orgId: data?.id ?? null,
      orgSlug: data?.slug ?? null,
    };
    this.updateCurrentGuide();
  },

  onFetchSucceeded(data) {
    // It's possible we can get empty responses (seems to be Firefox specific)
    // Do nothing if `data` is empty
    // also, temporarily check data is in the correct format from the updated
    // assistant endpoint
    if (!data || !Array.isArray(data)) {
      return;
    }

    const guidesContent = getGuidesContent(this.state.orgSlug);

    // map server guide state (i.e. seen status) with guide content
    const guides = guidesContent.reduce<Guide[]>((acc, content) => {
      const serverGuide = data.find(guide => guide.guide === content.guide);
      if (serverGuide) {
        acc.push({...content, ...serverGuide});
      }
      return acc;
    }, []);

    this.state = {...this.state, guides};
    this.updateCurrentGuide();
  },

  onCloseGuide(dismissed?: boolean) {
    const {currentGuide, guides} = this.state;

    // update the current guide seen to true or all guides if markOthersAsSeen
    // is true and the user is dismissing
    const updatedGuides = guides.map(guide => {
      const shouldUpdateSeen =
        guide.guide === currentGuide?.guide ||
        (currentGuide?.markOthersAsSeen && dismissed);

      return shouldUpdateSeen ? {...guide, seen: true} : guide;
    });

    this.state = {...this.state, guides: updatedGuides, forceShow: false};
    this.updateCurrentGuide();
  },

  onNextStep() {
    const {currentStep} = this.state;
    this.state = {...this.state, currentStep: currentStep + 1};
    this.trigger(this.state);
  },

  onToStep(step: number) {
    this.state = {...this.state, currentStep: step};
    this.trigger(this.state);
  },

  onRegisterAnchor(target) {
    this.state.anchors.add(target);
    this.updateCurrentGuide();
  },

  onUnregisterAnchor(target) {
    this.state.anchors.delete(target);
    this.updateCurrentGuide();
  },

  onSetForceHide(forceHide) {
    this.state = {...this.state, forceHide};
    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },

  recordCue(guide) {
    const user = ConfigStore.get('user');
    if (!user) {
      return;
    }

    const data = {
      guide,
      eventKey: 'assistant.guide_cued',
      eventName: 'Assistant Guide Cued',
      organization_id: this.state.orgId,
      user_id: parseInt(user.id, 10),
    };
    trackAnalyticsEvent(data);
  },

  updatePrevGuide(nextGuide) {
    const {prevGuide} = this.state;
    if (!nextGuide) {
      return;
    }

    if (!prevGuide || prevGuide.guide !== nextGuide.guide) {
      this.recordCue(nextGuide.guide);
      this.state = {...this.state, prevGuide: nextGuide};
    }
  },

  /**
   * Logic to determine if a guide is shown:
   *
   *  - If any required target is missing, don't show the guide
   *  - If the URL ends with #assistant, show the guide
   *  - If the user has already seen the guide, don't show the guide
   *  - Otherwise show the guide
   */
  updateCurrentGuide() {
    const {anchors, guides, forceShow} = this.state;

    let guideOptions = guides
      .sort(guidePrioritySort)
      .filter(guide => guide.requiredTargets.every(target => anchors.has(target)));

    const user = ConfigStore.get('user');
    const userDateJoined = new Date(user?.dateJoined);

    if (!forceShow) {
      guideOptions = guideOptions.filter(({seen, dateThreshold}) => {
        if (seen) {
          return false;
        }
        if (user?.isSuperuser) {
          return true;
        }
        if (dateThreshold) {
          // Show the guide to users who've joined before the date threshold
          return userDateJoined < dateThreshold;
        }
        return userDateJoined > ASSISTANT_THRESHOLD;
      });
    }

    const nextGuide =
      guideOptions.length > 0
        ? {
            ...guideOptions[0],
            steps: guideOptions[0].steps.filter(
              step => step.target && anchors.has(step.target)
            ),
          }
        : null;

    this.updatePrevGuide(nextGuide);

    const nextStep =
      nextGuide &&
      this.state.currentGuide &&
      this.state.currentGuide.guide === nextGuide.guide
        ? this.state.currentStep
        : 0;

    this.state = {
      ...this.state,
      currentGuide: nextGuide,
      currentStep: nextStep,
    };

    this.trigger(this.state);
  },
};

const GuideStore = createStore(makeSafeRefluxStore(storeConfig));

export default GuideStore;
