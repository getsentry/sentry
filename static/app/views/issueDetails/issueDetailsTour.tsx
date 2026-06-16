import {createContext, useContext, useEffect, useRef} from 'react';

import issueDetailsPreview from 'sentry-images/issue_details/issue-details-preview.png';

import {useModal} from '@sentry/scraps/modal';

import type {TourContextType} from 'sentry/components/tours/tourContext';
import {useAssistant, useMutateAssistant} from 'sentry/components/tours/useAssistant';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

export const enum IssueDetailsTour {
  /** Trends and aggregates, the graph, and tag distributions */
  AGGREGATES = 'issue-details-aggregates',
  /** Date/time/environment filters */
  FILTERS = 'issue-details-filters',
  /** Event details, event navigation, main page content */
  EVENT_DETAILS = 'issue-details-event-details',
  /** Event navigation; next/previous, first/last/recommended events */
  NAVIGATION = 'issue-details-navigation',
  /** Workflow actions; resolution, archival, assignment, priority, etc. */
  WORKFLOWS = 'issue-details-workflows',
  /** Activity log, issue tracking, seer area */
  SIDEBAR = 'issue-details-sidebar',
}

export const ORDERED_ISSUE_DETAILS_TOUR = [
  IssueDetailsTour.AGGREGATES,
  IssueDetailsTour.FILTERS,
  IssueDetailsTour.EVENT_DETAILS,
  IssueDetailsTour.NAVIGATION,
  IssueDetailsTour.WORKFLOWS,
  IssueDetailsTour.SIDEBAR,
];

export const ISSUE_DETAILS_TOUR_GUIDE_KEY = 'tour.issue_details';
const ISSUE_DETAILS_TOUR_FORCE_HASH = '#issue-details-tour';

export const IssueDetailsTourContext =
  createContext<TourContextType<IssueDetailsTour> | null>(null);

function useIssueDetailsTourModal() {
  const {openModal} = useModal();
  const organization = useOrganization();
  const hasOpenedTourModal = useRef(false);
  const {isRegistered, currentStepId, startTour, endTour} = useContext(
    IssueDetailsTourContext
  )!;
  const {data: assistantData} = useAssistant({
    notifyOnChangeProps: ['data'],
  });
  const {mutate: mutateAssistant} = useMutateAssistant();
  const forceShowTourModal = window.location.hash === ISSUE_DETAILS_TOUR_FORCE_HASH;
  const hasUnseenIssueDetailsTour =
    assistantData?.find(item => item.guide === ISSUE_DETAILS_TOUR_GUIDE_KEY)?.seen ===
    false;

  const shouldShowTourModal =
    !process.env.IS_ACCEPTANCE_TEST &&
    currentStepId === null &&
    (forceShowTourModal || hasUnseenIssueDetailsTour);

  useEffect(() => {
    if (!isRegistered || !shouldShowTourModal || hasOpenedTourModal.current) {
      return;
    }

    let cancelled = false;
    const dismissTour = () => {
      mutateAssistant({
        guide: ISSUE_DETAILS_TOUR_GUIDE_KEY,
        status: 'dismissed',
      });
      endTour();
      trackAnalytics('issue_details.tour.skipped', {organization});
    };

    hasOpenedTourModal.current = true;
    void import('sentry/components/tours/startTour').then(
      ({StartTourModal, startTourModalCss}) => {
        if (cancelled) {
          return;
        }

        openModal(
          props => (
            <StartTourModal
              closeModal={props.closeModal}
              img={{
                src: issueDetailsPreview,
                alt: t('Preview of the issue details experience'),
              }}
              header={t('Welcome to issue details')}
              description={t(
                "This is where you'll come every time something breaks. It shows what happened, why it happened, and what to do next.\n\nNew here? Take a tour - we promise you'll be less confused."
              )}
              onDismissTour={dismissTour}
              onStartTour={() => {
                startTour();
                trackAnalytics('issue_details.tour.started', {
                  organization,
                  method: 'modal',
                });
              }}
            />
          ),
          {
            modalCss: startTourModalCss,
            onClose: reason => {
              if (reason) {
                dismissTour();
              }
            },
          }
        );
      }
    );

    return () => {
      cancelled = true;
    };
  }, [
    endTour,
    forceShowTourModal,
    isRegistered,
    mutateAssistant,
    openModal,
    organization,
    shouldShowTourModal,
    startTour,
  ]);
}

export function IssueDetailsTourModal() {
  useIssueDetailsTourModal();
  return null;
}
