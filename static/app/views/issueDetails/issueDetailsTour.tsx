import {createContext, useContext} from 'react';

import type {TourContextType} from 'sentry/components/tours/tourContext';

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
  /** Activity log, issue tracking, solutions hub area */
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

export const IssueDetailsTourContext =
  createContext<TourContextType<IssueDetailsTour> | null>(null);

export function useIssueDetailsTour(): TourContextType<IssueDetailsTour> {
  const tourContext = useContext(IssueDetailsTourContext);
  if (!tourContext) {
    throw new Error('Must be used within a TourContextProvider<IssueDetailsTour>');
  }
  return tourContext;
}
