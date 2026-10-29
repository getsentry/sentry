import {createContext, useContext, useEffect, type ReactNode} from 'react';

import {useModal} from '@sentry/scraps/modal';

import {
  TourContextProvider,
  TourElement,
  type TourElementProps,
} from 'sentry/components/tours/components';
import type {TourContextType} from 'sentry/components/tours/tourContext';
import {useAssistant} from 'sentry/components/tours/useAssistant';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useNavigationTour} from 'sentry/views/navigation/navigationTour';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {useSettingsNavigation} from 'sentry/views/navigation/useSettingsNavigation';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

// TODO: Set to the settings navigation GA date. Users who join after it don't see the tour.
const SETTINGS_NAVIGATION_GA_DATE = new Date(2026, 11, 1);

// Must match the guide key registered in `src/sentry/assistant/guides.py`.
const SETTINGS_NAVIGATION_TOUR_GUIDE_KEY = 'tour.settings_navigation';

const STEPS = ['entry', 'projects'] as const;
type Step = (typeof STEPS)[number];

const SettingsNavigationTourContext = createContext<TourContextType<Step> | null>(null);

/**
 * Whether the tour can be shown right now. The tour pauses, rather than ends,
 * while this is false.
 */
function useCanShowSettingsNavigationTour() {
  const organization = useOrganization({allowNull: true});
  const user = useUser();
  const hasSettingsV3 = useSettingsV3();
  const inSettings = useSettingsNavigation();
  const {layout} = usePrimaryNavigation();
  const navigationTour = useNavigationTour();
  const {visible: isModalVisible} = useModal();

  // Only users who knew the old settings navigation need the tour.
  const isEligible =
    hasSettingsV3 &&
    !!organization &&
    new Date(user.dateJoined) < SETTINGS_NAVIGATION_GA_DATE;
  // The organization menu must be visible, and nothing else may be on top.
  const isMenuAvailable = layout === 'sidebar' && !inSettings;
  const isUnobstructed = !navigationTour.currentStepId && !isModalVisible;

  return isEligible && isMenuAvailable && isUnobstructed;
}

export function SettingsNavigationTourProvider({children}: {children: ReactNode}) {
  const canShow = useCanShowSettingsNavigationTour();
  const {data: assistantData} = useAssistant();
  // Treat the tour as seen until the assistant data says otherwise.
  const isSeen =
    assistantData?.find(item => item.guide === SETTINGS_NAVIGATION_TOUR_GUIDE_KEY)
      ?.seen ?? true;

  return (
    <TourContextProvider<Step>
      TourContext={SettingsNavigationTourContext}
      tourKey={SETTINGS_NAVIGATION_TOUR_GUIDE_KEY}
      isCompleted={false}
      orderedStepIds={STEPS}
      enabled={canShow}
      variant="subtle"
      requireAllStepsRegistered={false}
    >
      <SettingsNavigationTourStarter shouldStart={canShow && !isSeen} />
      {children}
    </TourContextProvider>
  );
}

function SettingsNavigationTourStarter({shouldStart}: {shouldStart: boolean}) {
  const tour = useContext(SettingsNavigationTourContext);
  const startTour = tour?.startTour;
  const isIdle = !!tour && !tour.isCompleted && tour.currentStepId === null;

  useEffect(() => {
    if (shouldStart && isIdle) {
      startTour?.();
    }
  }, [shouldStart, isIdle, startTour]);

  return null;
}

export function useSettingsNavigationTour() {
  return useContext(SettingsNavigationTourContext);
}

export function SettingsNavigationTourElement(
  props: Omit<TourElementProps<Step>, 'tourContext'>
) {
  return <TourElement<Step> tourContext={SettingsNavigationTourContext} {...props} />;
}
