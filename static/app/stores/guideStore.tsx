import {createStore} from 'reflux';

import getGuidesContent from 'sentry/components/assistant/getGuidesContent';
import type {
  Guide,
  GuidesContent,
  GuidesServerData,
} from 'sentry/components/assistant/types';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import ModalStore from 'sentry/stores/modalStore';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';

import type {StrictStoreDefinition} from './types';

function guidePrioritySort(a: Guide, b: Guide) {
  const a_priority = a.priority ?? Number.MAX_SAFE_INTEGER;
  const b_priority = b.priority ?? Number.MAX_SAFE_INTEGER;
  if (a_priority === b_priority) {
    return a.guide.localeCompare(b.guide);
  }
  // lower number takes priority
  return a_priority - b_priority;
}

export type GuideStoreState = {
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
   * Current Organization
   */
  organization: Organization | null;
  /**
   * The previously shown guide
   */
  prevGuide: Guide | null;
};

const defaultState: GuideStoreState = {
  forceHide: false,
  guides: [],
  anchors: new Set(),
  currentGuide: null,
  currentStep: 0,
  orgId: null,
  orgSlug: null,
  organization: null,
  forceShow: false,
  prevGuide: null,
};

function isForceEnabled() {
  return window.location.hash === '#assistant';
}

interface GuideStoreDefinition extends StrictStoreDefinition<GuideStoreState> {
  closeGuide(dismissed?: boolean): void;

  fetchSucceeded(data: GuidesServerData): void;
  modalStoreListener: null | ReturnType<typeof ModalStore.listen>;
  nextStep(): void;
  onURLChange(): void;
  recordCue(guide: string): void;
  registerAnchor(target: string): void;
  setActiveOrganization(data: Organization): void;
  setForceHide(forceHide: boolean): void;
  teardown(): void;
  toStep(step: number): void;
  unregisterAnchor(target: string): void;
  updateCurrentGuide(dismissed?: boolean): void;
  updatePrevGuide(nextGuide: Guide | null): void;
}

const storeConfig: GuideStoreDefinition = {
  state: {...defaultState},
  modalStoreListener: null,

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.state = {...defaultState, forceShow: isForceEnabled()};

    window.addEventListener('load', this.onURLChange, false);

    // Guides will show above modals, but are not interactable because
    // of the focus trap, so we force them to be hidden while a modal is open.
    this.modalStoreListener = ModalStore.listen(() => {
      const isOpen = typeof ModalStore.getState().renderer === 'function';

      if (isOpen) {
        this.setForceHide(true);
      } else {
        this.setForceHide(false);
      }
    }, undefined);
  },

  teardown() {
    window.removeEventListener('load', this.onURLChange);

    if (this.modalStoreListener) {
      this.modalStoreListener();
    }
  },

  getState() {
    return this.state;
  },

  onURLChange() {
    this.state = {...this.state, forceShow: isForceEnabled()};
    this.updateCurrentGuide();
  },

  setActiveOrganization(data: Organization) {
    this.state = {
      ...this.state,
      orgId: data ? data.id : null,
      orgSlug: data ? data.slug : null,
      organization: data ? data : null,
    };
    this.updateCurrentGuide();
  },

  fetchSucceeded(data) {
    // It's possible we can get empty responses (seems to be Firefox specific)
    // Do nothing if `data` is empty
    // also, temporarily check data is in the correct format from the updated
    // assistant endpoint
    if (!data || !Array.isArray(data)) {
      return;
    }

    const guidesContent: GuidesContent = getGuidesContent(this.state.organization);
    // map server guide state (i.e. seen status) with guide content
    const guides = guidesContent.reduce((acc: Guide[], content) => {
      const serverGuide = data.find(guide => guide.guide === content.guide);
      if (serverGuide) {
        acc.push({
          ...content,
          ...serverGuide,
        });
      }
      return acc;
    }, []);

    this.state = {...this.state, guides};
    this.updateCurrentGuide();
  },

  closeGuide(dismissed?: boolean) {
    const {currentGuide, guides} = this.state;

    const newGuides = guides.map(guide => {
      // update the current guide seen to true or all guides
      // if markOthersAsSeen is true and the user is dismissing
      if (
        guide.guide === currentGuide?.guide ||
        (currentGuide?.markOthersAsSeen && dismissed)
      ) {
        return {
          ...guide,
          seen: true,
        };
      }

      return guide;
    });
    this.state = {...this.state, guides: newGuides, forceShow: false};
    this.updateCurrentGuide();
  },

  nextStep() {
    this.state = {...this.state, currentStep: this.state.currentStep + 1};
    this.trigger(this.state);
  },

  toStep(step: number) {
    this.state = {...this.state, currentStep: step};
    this.trigger(this.state);
  },

  registerAnchor(target) {
    this.state.anchors.add(target);
    this.updateCurrentGuide();
  },

  unregisterAnchor(target) {
    this.state.anchors.delete(target);
    this.updateCurrentGuide();
  },

  setForceHide(forceHide) {
    this.state = {...this.state, forceHide};
    this.trigger(this.state);
  },

  recordCue(guide) {
    const user = ConfigStore.get('user');
    if (!user) {
      return;
    }

    trackAnalytics('assistant.guide_cued', {
      organization: this.state.orgId,
      guide,
    });
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
  updateCurrentGuide(dismissed?: boolean) {
    const {anchors, guides, forceShow} = this.state;

    let guideOptions = guides
      .sort(guidePrioritySort)
      .filter(guide => guide.requiredTargets.every(target => anchors.has(target)));

    const user = ConfigStore.get('user');
    const assistantThreshold = new Date(2019, 6, 1);
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
        return userDateJoined > assistantThreshold;
      });
    }

    // Remove steps that are missing anchors, unless the anchor is included in
    // the expectedTargets and will appear at the step.
    const nextGuide =
      guideOptions.length > 0
        ? {
            ...guideOptions[0]!,
            steps: guideOptions[0]!.steps.filter(
              step =>
                anchors.has(step.target) ||
                guideOptions[0]?.expectedTargets?.includes(step.target)
            ),
          }
        : null;

    this.updatePrevGuide(nextGuide);
    const currentStep =
      this.state.currentGuide &&
      nextGuide &&
      this.state.currentGuide.guide === nextGuide.guide
        ? this.state.currentStep
        : 0;
    this.state = {...this.state, currentGuide: nextGuide, currentStep};

    this.trigger(this.state);
    HookStore.get('callback:on-guide-update').map(cb => cb(nextGuide, {dismissed}));
  },
};

const GuideStore = createStore(storeConfig);
export default GuideStore;
