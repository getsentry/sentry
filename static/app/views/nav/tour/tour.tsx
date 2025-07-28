import {createContext, useCallback, useContext, useEffect, useMemo, useRef} from 'react';

import stackedNavTourSvg from 'sentry-images/spot/stacked-nav-tour.svg';

import {openModal} from 'sentry/actionCreators/modal';
import {
  TourAction,
  TourContextProvider,
  TourElement,
  type TourElementProps,
  TourGuide,
} from 'sentry/components/tours/components';
import {StartTourModal, startTourModalCss} from 'sentry/components/tours/startTour';
import type {TourContextType} from 'sentry/components/tours/tourContext';
import {useAssistant, useMutateAssistant} from 'sentry/components/tours/useAssistant';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {getDefaultExploreRoute} from 'sentry/views/explore/utils';
import {useNavContext} from 'sentry/views/nav/context';
import {PrimaryNavGroup} from 'sentry/views/nav/types';
import {useActiveNavGroup} from 'sentry/views/nav/useActiveNavGroup';

export const enum StackedNavigationTour {
  ISSUES = 'issues',
  EXPLORE = 'explore',
  DASHBOARDS = 'dashboards',
  INSIGHTS = 'insights',
  SETTINGS = 'settings',
}

// Started rolling out to GA users on June 18, 2025
const TOUR_MODAL_DATE_THRESHOLD = new Date(2025, 5, 18);

const ORDERED_STACKED_NAVIGATION_TOUR = [
  StackedNavigationTour.ISSUES,
  StackedNavigationTour.EXPLORE,
  StackedNavigationTour.DASHBOARDS,
  StackedNavigationTour.INSIGHTS,
  StackedNavigationTour.SETTINGS,
];

export const STACKED_NAVIGATION_TOUR_CONTENT = {
  [StackedNavigationTour.ISSUES]: {
    description: t(
      'Issues are problems detected by Sentry. Code breaks — we tell you where, when, and why.'
    ),
    title: t('See what broke'),
  },
  [StackedNavigationTour.EXPLORE]: {
    description: t(
      'Create queries, investigate data exemplars, and save charts for dashboards. Explore is where you turn raw data into answers.'
    ),
    title: t('Dig into data'),
  },
  [StackedNavigationTour.DASHBOARDS]: {
    description: t(
      'Dashboards enable you to display key insights all on one page. Create new or find existing custom dashboards here.'
    ),
    title: t('Track what matters'),
  },
  [StackedNavigationTour.INSIGHTS]: {
    description: t(
      'Project and domain insights live here, giving you prebuilt looks into your app’s health. '
    ),
    title: t('Know what’s happening'),
  },
  [StackedNavigationTour.SETTINGS]: {
    description: t(
      'Stats & Usage is now under Organization Settings. We’ve consolidated this page so you can see all your configurations in one place.'
    ),
    title: t('Find more in Settings'),
  },
};

const STACKED_NAVIGATION_TOUR_GUIDE_KEY = 'tour.stacked_navigation';

const StackedNavigationTourContext =
  createContext<TourContextType<StackedNavigationTour> | null>(null);

export function useStackedNavigationTour(): TourContextType<StackedNavigationTour> {
  const tourContext = useContext(StackedNavigationTourContext);
  if (!tourContext) {
    throw new Error('Must be used within a TourContextProvider<StackedNavigationTour>');
  }
  return tourContext;
}

export function NavTourElement({
  children,
  ...props
}: Omit<TourElementProps<StackedNavigationTour>, 'tourContext'>) {
  return (
    <TourElement<StackedNavigationTour>
      tourContext={StackedNavigationTourContext}
      position="right-start"
      {...props}
    >
      {children}
    </TourElement>
  );
}

function useStackedNavigationTourCompleted() {
  const {data: assistantData} = useAssistant();

  return useMemo(() => {
    const stackedNavigationTourData = assistantData?.find(
      item => item.guide === STACKED_NAVIGATION_TOUR_GUIDE_KEY
    );

    return stackedNavigationTourData?.seen ?? true;
  }, [assistantData]);
}

export function NavigationTourProvider({children}: {children: React.ReactNode}) {
  const organization = useOrganization();
  const isStackedNavigationTourCompleted = useStackedNavigationTourCompleted();
  const initialUrlRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const {setShowTourReminder} = useNavContext();
  const location = useLocation();
  const activeGroup = useActiveNavGroup();

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
    (stepId: StackedNavigationTour) => {
      const prefix = `organizations/${organization.slug}`;
      switch (stepId) {
        case StackedNavigationTour.ISSUES:
          if (activeGroup !== PrimaryNavGroup.ISSUES) {
            const target = normalizeUrl({
              pathname: `/${prefix}/issues/`,
              query: {referrer: NAV_REFERRER},
            });
            navigate(target, {replace: true});
          }
          break;
        case StackedNavigationTour.EXPLORE:
          if (activeGroup !== PrimaryNavGroup.EXPLORE) {
            const target = normalizeUrl({
              pathname: `/${prefix}/explore/${getDefaultExploreRoute(organization)}/`,
              query: {referrer: NAV_REFERRER},
            });
            navigate(target, {replace: true});
          }
          break;
        case StackedNavigationTour.DASHBOARDS:
          if (activeGroup !== PrimaryNavGroup.DASHBOARDS) {
            const target = normalizeUrl({
              pathname: `/${prefix}/dashboards/`,
              query: {referrer: NAV_REFERRER},
            });
            navigate(target, {replace: true});
          }
          break;
        case StackedNavigationTour.INSIGHTS:
          if (activeGroup !== PrimaryNavGroup.INSIGHTS) {
            const target = normalizeUrl({
              pathname: `/${prefix}/insights/frontend/`,
              query: {referrer: NAV_REFERRER},
            });
            navigate(target, {replace: true});
          }
          break;
        case StackedNavigationTour.SETTINGS:
          if (activeGroup !== PrimaryNavGroup.SETTINGS) {
            const target = normalizeUrl({
              pathname: `/settings/${organization.slug}/`,
              query: {referrer: NAV_REFERRER},
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
    <TourContextProvider<StackedNavigationTour>
      tourKey={STACKED_NAVIGATION_TOUR_GUIDE_KEY}
      isCompleted={isStackedNavigationTourCompleted}
      orderedStepIds={ORDERED_STACKED_NAVIGATION_TOUR}
      TourContext={StackedNavigationTourContext}
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

export function StackedNavigationTourReminder({children}: {children: React.ReactNode}) {
  const {showTourReminder, setShowTourReminder} = useNavContext();

  return (
    <TourGuide
      title={t('Come back anytime')}
      description={t(
        'You can always use the help menu to take this tour again, switch to the old experience, or share feedback with the team.'
      )}
      actions={
        <TourAction
          size="xs"
          onClick={() => {
            setShowTourReminder(false);
          }}
        >
          {t('Got it')}
        </TourAction>
      }
      isOpen={showTourReminder}
    >
      {children}
    </TourGuide>
  );
}

// Displays the introductory tour modal when a user is entering the experience for the first time.
export function useTourModal() {
  const organization = useOrganization();
  const hasOpenedTourModal = useRef(false);
  const {startTour, endTour} = useStackedNavigationTour();
  const {data: assistantData} = useAssistant({
    notifyOnChangeProps: ['data'],
  });
  const {mutate: mutateAssistant} = useMutateAssistant();
  const user = useUser();
  const [localTourState, setLocalTourState] = useLocalStorageState(
    STACKED_NAVIGATION_TOUR_GUIDE_KEY,
    {hasSeen: false}
  );

  const enforceStackedNav = organization.features.includes('enforce-stacked-navigation');
  // We don't want to show the tour modal for new users that were forced into the new stacked navigation.
  const shouldSkipForNewUserEnforcedStackedNav =
    enforceStackedNav && new Date(user?.dateJoined) > TOUR_MODAL_DATE_THRESHOLD;

  const shouldShowTourModal =
    assistantData?.find(item => item.guide === STACKED_NAVIGATION_TOUR_GUIDE_KEY)
      ?.seen === false &&
    !shouldSkipForNewUserEnforcedStackedNav &&
    !localTourState.hasSeen;

  const dismissTour = useCallback(() => {
    trackAnalytics('navigation.tour_modal_dismissed', {organization});
    mutateAssistant({
      guide: STACKED_NAVIGATION_TOUR_GUIDE_KEY,
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
            img={{src: stackedNavTourSvg, alt: t('Stacked Navigation Tour')}}
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

const NAV_REFERRER = 'nav-tour';

export function useIsNavTourActive() {
  const location = useLocation();
  return location.query.referrer === NAV_REFERRER;
}
