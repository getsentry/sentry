import {createContext, useContext} from 'react';

import {TourElement, type TourElementProps} from 'sentry/components/tours/components';
import type {TourContextType} from 'sentry/components/tours/tourContext';

export const enum IssueDetailsTour {
  /** Onboarding for trends and aggregates, the graph, and tag distributions */
  AGGREGATES = 'issue-details-aggregates',
  /** Onboarding for date/time/environment filters */
  FILTERS = 'issue-details-filters',
  /** Onboarding for event details, event navigation, main page content */
  EVENT_DETAILS = 'issue-details-event-details',
  /** Onboarding for event navigation; next/previous, first/last/recommended events */
  NAVIGATION = 'issue-details-navigation',
  /** Onboarding for workflow actions; resolution, archival, assignment, priority, etc. */
  WORKFLOWS = 'issue-details-workflows',
  /** Onboarding for activity log, issue tracking, solutions hub area */
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

export const IssueDetailsTourContext = createContext<TourContextType<IssueDetailsTour>>({
  currentStep: null,
  isAvailable: false,
  orderedStepIds: ORDERED_ISSUE_DETAILS_TOUR,
  dispatch: () => {},
  registerStep: () => {},
});

export function useIssueDetailsTour(): TourContextType<IssueDetailsTour> {
  return useContext(IssueDetailsTourContext);
}

export function IssueDetailsTourElement(props: TourElementProps<IssueDetailsTour>) {
  const tourContext = useIssueDetailsTour();
  return <TourElement tourContext={tourContext} {...props} />;
}
