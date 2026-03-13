import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import NavigationTourSvg from 'sentry-images/spot/stacked-nav-tour.svg';

import {openModal} from 'sentry/actionCreators/modal';
import {
  TourAction,
  TourContextProvider,
  TourElement,
  TourGuide,
  type TourElementProps,
} from 'sentry/components/tours/components';
import {StartTourModal, startTourModalCss} from 'sentry/components/tours/startTour';
import type {TourContextType} from 'sentry/components/tours/tourContext';
import {useAssistant, useMutateAssistant} from 'sentry/components/tours/useAssistant';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {getDefaultExploreRoute} from 'sentry/views/explore/utils';
import {PrimaryNavigationGroup} from 'sentry/views/navigation/types';
import {useActiveNavigationGroup} from 'sentry/views/navigation/useActiveNavigationGroup';

export const enum NavigationTour {
  ISSUES = 'issues',
  EXPLORE = 'explore',
  DASHBOARDS = 'dashboards',
  INSIGHTS = 'insights',
  SETTINGS = 'settings',
}

// Started rolling out to GA users on June 18, 2025
const TOUR_MODAL_DATE_THRESHOLD = new Date(2025, 5, 18);
const NAVIGATION_TOUR_REFERRER = 'nav-tour';

const ORDERED_NAVIGATION_TOUR = [
  NavigationTour.ISSUES,
  NavigationTour.EXPLORE,
  NavigationTour.DASHBOARDS,
  NavigationTour.INSIGHTS,
  NavigationTour.SETTINGS,
];

export const NAVIGATION_TOUR_CONTENT = {
  [NavigationTour.ISSUES]: {
    description: t(
      'Issues are problems detected by Sentry. Code breaks — we tell you where, when, and why.'
    ),
    title: t('See what broke'),
  },
  [NavigationTour.EXPLORE]: {
    description: t(
      'Create queries, investigate data exemplars, and save charts for dashboards. Explore is where you turn raw data into answers.'
    ),
    title: t('Dig into data'),
  },
  [NavigationTour.DASHBOARDS]: {
    description: t(
      'Dashboards enable you to display key insights all on one page. Create new or find existing custom dashboards here.'
    ),
    title: t('Track what matters'),
  },
  [NavigationTour.INSIGHTS]: {
    description: t(
      'Project and domain insights live here, giving you prebuilt looks into your app’s health. '
    ),
    title: t('Know what’s happening'),
  },
  [NavigationTour.SETTINGS]: {
    description: t(
      'Stats & Usage is now under Organization Settings. We’ve consolidated this page so you can see all your configurations in one place.'
    ),
    title: t('Find more in Settings'),
  },
};

// Note: this key is used as an analytics/assistant guide identifier and must
// remain stable — do not rename it even if the surrounding code is refactored.
const NAVIGATION_TOUR_GUIDE_KEY = 'tour.stacked_navigation';

const NavigationTourContext = createContext<TourContextType<NavigationTour> | null>(null);

export function useNavigationTour(): TourContextType<NavigationTour> {
  const tourContext = useContext(NavigationTourContext);
  if (!tourContext) {
    throw new Error('Must be used within a TourContextProvider<NavigationTour>');
  }
  return tourContext;
}

export function NavigationTourElement({
  children,
  ...props
}: Omit<TourElementProps<NavigationTour>, 'tourContext'>) {
  return (
    <TourElement<NavigationTour>
      tourContext={NavigationTourContext}
      position="right-start"
      {...props}
    >
      {children}
    </TourElement>
  );
}

function useNavigationTourCompleted() {
  const {data: assistantData} = useAssistant();

  return useMemo(() => {
    const navigationTourData = assistantData?.find(
      item => item.guide === NAVIGATION_TOUR_GUIDE_KEY
    );

    return navigationTourData?.seen ?? true;
  }, [assistantData]);
}

export function NavigationTourProvider({children}: {children: React.ReactNode}) {
  const {setShowTourReminder} = useNavigationTourReminderContext();
  const organization = useOrganization();
  const isNavigationTourCompleted = useNavigationTourCompleted();
  const initialUrlRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const activeGroup = useActiveNavigationGroup();

  const onStartTour = useCallback(() => {
    // Save the initial URL when the tour starts because we need to restore it when the tour ends.
    initialUrlRef.current = location.pathname + location.search + location.hash;

    // Scroll to top and lock scrolling when the tour starts.
    document.documentElement.style.overflow = 'hidden';
    window.scrollTo(0, 0);
  }, [location.hash, location.pathname, location.search]);

  const onEndTour = useCallback(() => {
    setShowTourReminder(true);

    // Restore the initial URL when the tour ends.
    if (initialUrlRef.current) {
      navigate(initialUrlRef.current, {replace: true});
    }
    initialUrlRef.current = null;

    // Unlock scrolling when the tour ends.
    document.documentElement.style.overflow = '';
  }, [navigate, setShowTourReminder]);

  const onStepChange = useCallback(
    (stepId: NavigationTour) => {
      const prefix = `organizations/${organization.slug}`;
      switch (stepId) {
        case NavigationTour.ISSUES:
          if (activeGroup !== PrimaryNavigationGroup.ISSUES) {
            const target = normalizeUrl({
              pathname: `/${prefix}/issues/`,
              query: {referrer: NAVIGATION_TOUR_REFERRER},
            });
            navigate(target, {replace: true});
          }
          break;
        case NavigationTour.EXPLORE:
          if (activeGroup !== PrimaryNavigationGroup.EXPLORE) {
            const target = normalizeUrl({
              pathname: `/${prefix}/explore/${getDefaultExploreRoute(organization)}/`,
              query: {referrer: NAVIGATION_TOUR_REFERRER},
            });
            navigate(target, {replace: true});
          }
          break;
        case NavigationTour.DASHBOARDS:
          if (activeGroup !== PrimaryNavigationGroup.DASHBOARDS) {
            const target = normalizeUrl({
              pathname: `/${prefix}/dashboards/`,
              query: {referrer: NAVIGATION_TOUR_REFERRER},
            });
            navigate(target, {replace: true});
          }
          break;
        case NavigationTour.INSIGHTS:
          if (activeGroup !== PrimaryNavigationGroup.INSIGHTS) {
            const target = normalizeUrl({
              pathname: `/${prefix}/insights/frontend/`,
              query: {referrer: NAVIGATION_TOUR_REFERRER},
            });
            navigate(target, {replace: true});
          }
          break;
        case NavigationTour.SETTINGS:
          if (activeGroup !== PrimaryNavigationGroup.SETTINGS) {
            const target = normalizeUrl({
              pathname: `/settings/${organization.slug}/`,
              query: {referrer: NAVIGATION_TOUR_REFERRER},
            });
            navigate(target, {replace: true});
          }
          break;
        default:
          break;
      }
    },
    [activeGroup, navigate, organization]
  );

  return (
    <TourContextProvider<NavigationTour>
      tourKey={NAVIGATION_TOUR_GUIDE_KEY}
      isCompleted={isNavigationTourCompleted}
      orderedStepIds={ORDERED_NAVIGATION_TOUR}
      TourContext={NavigationTourContext}
      onStartTour={onStartTour}
      onEndTour={onEndTour}
      onStepChange={onStepChange}
      // Because we use a single tour element on the sidebar for multiple steps,
      // we can't have all steps present in the DOM at once.
      requireAllStepsRegistered={false}
    >
      {children}
    </TourContextProvider>
  );
}

const NavigationTourReminderContext = createContext<{
  setShowTourReminder: (value: boolean) => void;
  showTourReminder: boolean;
}>({
  showTourReminder: false,
  setShowTourReminder: () => {},
});

function useNavigationTourReminderContext(): {
  setShowTourReminder: (value: boolean) => void;
  showTourReminder: boolean;
} {
  const context = useContext(NavigationTourReminderContext);
  if (!context) {
    throw new Error('Must be used within a NavigationTourReminderContextProvider');
  }
  return context;
}

export function NavigationTourReminderContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showTourReminder, setShowTourReminder] = useState(false);

  const contextValue = useMemo(
    () => ({showTourReminder, setShowTourReminder}),
    [showTourReminder, setShowTourReminder]
  );

  return (
    <NavigationTourReminderContext.Provider value={contextValue}>
      {children}
    </NavigationTourReminderContext.Provider>
  );
}

export function NavigationTourReminder({children}: {children: React.ReactNode}) {
  const {showTourReminder, setShowTourReminder} = useNavigationTourReminderContext();

  if (!showTourReminder) {
    return children;
  }

  return (
    <TourGuide
      title={t('Come back anytime')}
      description={t(
        'You can always use the help menu to take this tour again or share feedback with the team.'
      )}
      actions={
        <TourAction size="xs" onClick={() => setShowTourReminder(false)}>
          {t('Got it')}
        </TourAction>
      }
      isOpen={showTourReminder}
    >
      {props => <div {...props}>{children}</div>}
    </TourGuide>
  );
}

// Displays the introductory tour modal when a user is entering the experience for the first time.
export function useNavigationTourModal() {
  const user = useUser();
  const organization = useOrganization();
  const hasOpenedTourModal = useRef(false);
  const {startTour, endTour} = useNavigationTour();
  const {data: assistantData} = useAssistant({
    notifyOnChangeProps: ['data'],
  });
  const {mutate: mutateAssistant} = useMutateAssistant();
  const [localTourState, setLocalTourState] = useLocalStorageState(
    NAVIGATION_TOUR_GUIDE_KEY,
    {hasSeen: false}
  );

  // We don't want to show the tour modal for new users that were forced into the new  navigation.
  const shouldSkipTourForNewUsers =
    new Date(user?.dateJoined) > TOUR_MODAL_DATE_THRESHOLD;

  const shouldShowTourModal =
    assistantData?.find(item => item.guide === NAVIGATION_TOUR_GUIDE_KEY)?.seen ===
      false &&
    !shouldSkipTourForNewUsers &&
    !localTourState.hasSeen &&
    !process.env.IS_ACCEPTANCE_TEST;

  const dismissTour = useCallback(() => {
    trackAnalytics('navigation.tour_modal_dismissed', {organization});
    mutateAssistant({
      guide: NAVIGATION_TOUR_GUIDE_KEY,
      status: 'dismissed',
    });
    setLocalTourState({hasSeen: true});
    endTour();
  }, [mutateAssistant, organization, endTour, setLocalTourState]);

  useEffect(() => {
    if (shouldShowTourModal && !hasOpenedTourModal.current) {
      hasOpenedTourModal.current = true;
      trackAnalytics('navigation.tour_modal_shown', {organization});
      openModal(
        props => (
          <StartTourModal
            img={{src: NavigationTourSvg, alt: t('Navigation Tour')}}
            header={t('Welcome to a simpler Sentry')}
            description={t(
              'Find what you need, faster. Our new navigation puts your top workflows front and center.'
            )}
            closeModal={props.closeModal}
            onDismissTour={dismissTour}
            onStartTour={startTour}
          />
        ),
        {
          modalCss: startTourModalCss,

          // If user closes modal through other means, also prevent the modal from being shown again.
          onClose: reason => {
            if (reason) {
              dismissTour();
            }
          },
        }
      );
    }
  }, [
    shouldShowTourModal,
    startTour,
    mutateAssistant,
    endTour,
    organization,
    dismissTour,
  ]);
}

export function useIsNavigationTourActive() {
  const location = useLocation();
  return location.query.referrer === NAVIGATION_TOUR_REFERRER;
}
