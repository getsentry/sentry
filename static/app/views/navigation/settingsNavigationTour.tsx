import {createContext, useContext, useEffect, type ReactNode} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';

import {
  TextTourAction,
  TourAction,
  TourContextProvider,
  TourElement,
  type TourElementProps,
} from 'sentry/components/tours/components';
import type {TourContextType} from 'sentry/components/tours/tourContext';
import {useAssistant, useMutateAssistant} from 'sentry/components/tours/useAssistant';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
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

export function SettingsNavigationTourProvider({children}: {children: ReactNode}) {
  const organization = useOrganization({allowNull: true});
  const user = useUser();
  const enabled = useSettingsV3();
  const inSettings = useSettingsNavigation();
  const {layout} = usePrimaryNavigation();
  const navigationTour = useNavigationTour();
  const {visible: isModalVisible} = useModal();
  const {data: assistantData} = useAssistant();
  // Treat the tour as seen until the assistant data says otherwise.
  const isSeen =
    assistantData?.find(item => item.guide === SETTINGS_NAVIGATION_TOUR_GUIDE_KEY)
      ?.seen ?? true;
  const canShow =
    enabled &&
    !!organization &&
    new Date(user.dateJoined) < SETTINGS_NAVIGATION_GA_DATE &&
    layout === 'sidebar' &&
    !inSettings &&
    !navigationTour.currentStepId &&
    !isModalVisible;

  // The tour pauses, rather than ends, while it can't be shown.
  return (
    <TourContextProvider<Step>
      TourContext={SettingsNavigationTourContext}
      tourKey={SETTINGS_NAVIGATION_TOUR_GUIDE_KEY}
      isCompleted={false}
      orderedStepIds={STEPS}
      enabled={canShow}
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
  props: Omit<TourElementProps<Step>, 'tourContext' | 'actions'>
) {
  const tour = useContext(SettingsNavigationTourContext);
  const organization = useOrganization({allowNull: true});
  const {mutate: mutateAssistant} = useMutateAssistant();
  const isFirstStep = props.id === STEPS[0];
  const isLastStep = props.id === STEPS[STEPS.length - 1];
  const analyticsParams = {
    organization,
    id: props.id,
    step_count: STEPS.indexOf(props.id) + 1,
    tour_key: SETTINGS_NAVIGATION_TOUR_GUIDE_KEY,
  };

  // Mirror the shared close button and finish action, which these replace.
  const skipTour = () => {
    mutateAssistant({
      guide: SETTINGS_NAVIGATION_TOUR_GUIDE_KEY,
      status: 'dismissed',
    });
    trackAnalytics('tour-guide.dismiss', analyticsParams);
    tour?.endTour();
  };
  const finishTour = () => {
    trackAnalytics('tour-guide.finish', analyticsParams);
    tour?.endTour();
  };

  return (
    <TourElement<Step>
      tourContext={SettingsNavigationTourContext}
      actions={
        <Flex data-settings-navigation-tour gap="md" align="center">
          <TextTourAction onClick={isFirstStep ? skipTour : tour?.previousStep}>
            {isFirstStep ? t('Skip tour') : t('Previous')}
          </TextTourAction>
          <TourAction onClick={isLastStep ? finishTour : tour?.nextStep}>
            {isLastStep ? t('Done') : t('Next')}
          </TourAction>
        </Flex>
      }
      {...props}
    />
  );
}
