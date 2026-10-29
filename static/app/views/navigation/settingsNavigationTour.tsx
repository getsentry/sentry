import {createContext, useContext, useEffect, useMemo, type ReactNode} from 'react';

import {useHotkeys} from '@sentry/scraps/hotkey';
import {Flex} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';

import {
  TextTourAction,
  TourAction,
  TourElement,
  type TourElementProps,
} from 'sentry/components/tours/components';
import {useTourReducer, type TourContextType} from 'sentry/components/tours/tourContext';
import {useAssistant, useMutateAssistant} from 'sentry/components/tours/useAssistant';
import {t} from 'sentry/locale';
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
 * Uses the shared tour state instead of `TourContextProvider`, because this tour
 * must not blur the page and pauses, rather than ends, while it can't be shown.
 */
export function SettingsNavigationTourProvider({children}: {children: ReactNode}) {
  const organization = useOrganization({allowNull: true});
  const user = useUser();
  const enabled = useSettingsV3();
  const inSettings = useSettingsNavigation();
  const {layout} = usePrimaryNavigation();
  const navigationTour = useNavigationTour();
  const {visible: isModalVisible} = useModal();
  const {data: assistantData} = useAssistant();
  const {mutate: mutateAssistant} = useMutateAssistant();
  // Treat the tour as seen until the assistant data says otherwise.
  const isSeen =
    assistantData?.find(item => item.guide === SETTINGS_NAVIGATION_TOUR_GUIDE_KEY)
      ?.seen ?? true;
  const options = useMemo(
    () => ({
      onEndTour: () =>
        mutateAssistant({guide: SETTINGS_NAVIGATION_TOUR_GUIDE_KEY, status: 'dismissed'}),
      requireAllStepsRegistered: false,
    }),
    [mutateAssistant]
  );
  const tour = useTourReducer<Step>(
    {
      isCompleted: false,
      isRegistered: false,
      orderedStepIds: STEPS,
      currentStepId: null,
      tourKey: SETTINGS_NAVIGATION_TOUR_GUIDE_KEY,
    },
    options
  );
  const {isCompleted, currentStepId, startTour, endTour} = tour;
  const canShow =
    enabled &&
    !!organization &&
    new Date(user.dateJoined) < SETTINGS_NAVIGATION_GA_DATE &&
    layout === 'sidebar' &&
    !inSettings &&
    !navigationTour.currentStepId &&
    !isModalVisible;
  const isActive = canShow && currentStepId !== null;

  useEffect(() => {
    if (canShow && !isSeen && !isCompleted && currentStepId === null) {
      startTour();
    }
  }, [canShow, isSeen, isCompleted, currentStepId, startTour]);

  useHotkeys(isActive ? [{match: 'Escape', callback: endTour}] : []);

  return (
    <SettingsNavigationTourContext
      value={canShow ? tour : {...tour, currentStepId: null}}
    >
      {children}
    </SettingsNavigationTourContext>
  );
}

export function useSettingsNavigationTour() {
  return useContext(SettingsNavigationTourContext);
}

export function SettingsNavigationTourElement(
  props: Omit<TourElementProps<Step>, 'tourContext' | 'actions'>
) {
  const tour = useContext(SettingsNavigationTourContext);
  const isFirstStep = props.id === STEPS[0];
  const isLastStep = props.id === STEPS[STEPS.length - 1];

  return (
    <TourElement<Step>
      tourContext={SettingsNavigationTourContext}
      actions={
        <Flex data-settings-navigation-tour gap="md" align="center">
          <TextTourAction onClick={isFirstStep ? tour?.endTour : tour?.previousStep}>
            {isFirstStep ? t('Skip tour') : t('Previous')}
          </TextTourAction>
          <TourAction onClick={isLastStep ? tour?.endTour : tour?.nextStep}>
            {isLastStep ? t('Done') : t('Next')}
          </TourAction>
        </Flex>
      }
      {...props}
    />
  );
}
