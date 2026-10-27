import {getGuidesContent} from 'sentry/components/assistant/getGuidesContent';
import type {Guide, GuidesServerData} from 'sentry/components/assistant/types';
import {getOverride} from 'sentry/overrideRegistry';
import {ConfigStore} from 'sentry/stores/configStore';
import {createLegacyStore} from 'sentry/stores/createLegacyStore';
import {ModalStore} from 'sentry/stores/modalStore';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';

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

const store = createLegacyStore<GuideStoreState>(() => ({...defaultState}));

let unsubscribeModalStore: (() => void) | null = null;

function onURLChange() {
  store.setState({forceShow: isForceEnabled()});
  GuideStore.updateCurrentGuide();
}

export const GuideStore = {
  ...store,

  /**
   * @deprecated Use `getState()`
   */
  get state() {
    return store.getState();
  },

  init() {
    store.resetState({...defaultState, forceShow: isForceEnabled()});

    window.addEventListener('load', onURLChange, false);

    // Guides will show above modals, but are not interactable because
    // of the focus trap, so we force them to be hidden while a modal is open.
    unsubscribeModalStore = ModalStore.subscribe(modalState => {
      GuideStore.setForceHide(typeof modalState.renderer === 'function');
    });
  },

  teardown() {
    window.removeEventListener('load', onURLChange);
    unsubscribeModalStore?.();
    unsubscribeModalStore = null;
  },

  onURLChange,

  setActiveOrganization(data: Organization) {
    store.setState({
      orgId: data ? data.id : null,
      orgSlug: data ? data.slug : null,
      organization: data ? data : null,
    });
    GuideStore.updateCurrentGuide();
  },

  fetchSucceeded(data: GuidesServerData) {
    // It's possible we can get empty responses (seems to be Firefox specific)
    // Do nothing if `data` is empty
    // also, temporarily check data is in the correct format from the updated
    // assistant endpoint
    if (!data || !Array.isArray(data)) {
      return;
    }

    const guidesContent = getGuidesContent();
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

    store.setState({guides});
    GuideStore.updateCurrentGuide();
  },

  closeGuide(dismissed?: boolean) {
    const {currentGuide, guides} = store.getState();

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
    store.setState({guides: newGuides, forceShow: false});
    GuideStore.updateCurrentGuide(dismissed);
  },

  nextStep() {
    store.setState({currentStep: store.getState().currentStep + 1});
  },

  registerAnchor(target: string) {
    store.getState().anchors.add(target);
    GuideStore.updateCurrentGuide();
  },

  unregisterAnchor(target: string) {
    store.getState().anchors.delete(target);
    GuideStore.updateCurrentGuide();
  },

  setForceHide(forceHide: boolean) {
    store.setState({forceHide});
  },

  recordCue(guide: string) {
    const user = ConfigStore.get('user');
    if (!user) {
      return;
    }

    trackAnalytics('assistant.guide_cued', {
      organization: store.getState().orgId,
      guide,
    });
  },

  updatePrevGuide(nextGuide: Guide | null) {
    const {prevGuide} = store.getState();
    if (!nextGuide) {
      return;
    }

    if (prevGuide?.guide !== nextGuide.guide) {
      GuideStore.recordCue(nextGuide.guide);
      store.setState({prevGuide: nextGuide});
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
    const {anchors, guides, forceShow} = store.getState();

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

    GuideStore.updatePrevGuide(nextGuide);
    const {currentGuide, currentStep} = store.getState();
    store.setState({
      currentGuide: nextGuide,
      currentStep:
        currentGuide && currentGuide.guide === nextGuide?.guide ? currentStep : 0,
    });

    getOverride('callback:on-guide-update')?.(nextGuide, {dismissed});
  },
};

GuideStore.init();
