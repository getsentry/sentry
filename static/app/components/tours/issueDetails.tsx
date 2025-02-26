import {createContext, useContext} from 'react';

import {TourElement, type TourElementProps} from 'sentry/components/tours/components';
import type {TourContextType} from 'sentry/components/tours/tourContext';

export const enum IssueDetailsTour {
  /** Onboarding for trends and aggregates, the graph, and tag distributions */
  ISSUE_DETAILS_AGGREGATES = 'issue-details-aggregates',
  /** Onboarding for date/time/environment filters */
  ISSUE_DETAILS_FILTERS = 'issue-details-filters',
  /** Onboarding for event details, event navigation, main page content */
  ISSUE_DETAILS_EVENT_DETAILS = 'issue-details-event-details',
  /** Onboarding for event navigation; next/previous, first/last/recommended events */
  ISSUE_DETAILS_NAVIGATION = 'issue-details-navigation',
  /** Onboarding for workflow actions; resolution, archival, assignment, priority, etc. */
  ISSUE_DETAILS_WORKFLOWS = 'issue-details-workflows',
  /** Onboarding for activity log, issue tracking, solutions hub area */
  ISSUE_DETAILS_SIDEBAR = 'issue-details-sidebar',
}

export const ORDERED_ISSUE_DETAILS_TOUR = [
  IssueDetailsTour.ISSUE_DETAILS_AGGREGATES,
  IssueDetailsTour.ISSUE_DETAILS_FILTERS,
  IssueDetailsTour.ISSUE_DETAILS_EVENT_DETAILS,
  IssueDetailsTour.ISSUE_DETAILS_NAVIGATION,
  IssueDetailsTour.ISSUE_DETAILS_WORKFLOWS,
  IssueDetailsTour.ISSUE_DETAILS_SIDEBAR,
];

export const IssueDetailsTourContext = createContext<TourContextType<IssueDetailsTour>>({
  currentStep: null,
  isAvailable: false,
  orderedStepIds: ORDERED_ISSUE_DETAILS_TOUR,
  dispatch: () => {},
});

export function useIssueDetailsTour(): TourContextType<IssueDetailsTour> {
  return useContext(IssueDetailsTourContext);
}

export function IssueDetailsTourElement(
  props: Omit<TourElementProps<IssueDetailsTour>, 'tourContext'>
) {
  const tourContext = useIssueDetailsTour();
  return <TourElement tourContext={tourContext} {...props} />;
}
