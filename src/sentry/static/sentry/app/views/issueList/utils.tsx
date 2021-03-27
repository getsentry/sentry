import React from 'react';

import ExternalLink from 'app/components/links/externalLink';
import {t, tct} from 'app/locale';
import {Organization} from 'app/types';

export enum Query {
  FOR_REVIEW = 'is:unresolved is:for_review',
  FOR_REVIEW_OWNER = 'is:unresolved is:for_review assigned_or_suggested:me_or_none',
  UNRESOLVED = 'is:unresolved',
  IGNORED = 'is:ignored',
  REPROCESSING = 'is:reprocessing',
}

type OverviewTab = {
  name: string;
  /** Emitted analytics event tab name  */
  analyticsName: string;
  /** Will fetch a count to display on this tab */
  count: boolean;
  /** Tabs can be disabled via flag */
  enabled: boolean;
  /** Tooltip text for each tab */
  tooltipTitle: React.ReactNode;
  /** Tooltip text to be hoverable when text has links */
  tooltipHoverable?: boolean;
};

/**
 * Get a list of currently active tabs
 */
export function getTabs(organization: Organization) {
  const tabs: Array<[string, OverviewTab]> = [
    [
      Query.UNRESOLVED,
      {
        name: t('All Unresolved'),
        analyticsName: 'unresolved',
        count: true,
        enabled: true,
        tooltipTitle: t(`All unresolved issues.`),
      },
    ],
    [
      Query.FOR_REVIEW_OWNER,
      {
        name: t('For Review'),
        analyticsName: 'needs_review',
        count: true,
        enabled: organization.features.includes('inbox-owners-query'),
        tooltipTitle: t(`Unresolved issues that are new or have reopened. Review, ignore,
        or resolve an issue to move it out of this list. After 7 days these
        issues are automatically marked as reviewed.`),
      },
    ],
    [
      Query.FOR_REVIEW,
      {
        name: t('For Review'),
        analyticsName: 'needs_review',
        count: true,
        enabled: !organization.features.includes('inbox-owners-query'),
        tooltipTitle: t(`Unresolved issues that are new or have reopened. Review, ignore,
        or resolve an issue to move it out of this list. After 7 days these
        issues are automatically marked as reviewed.`),
      },
    ],
    [
      Query.IGNORED,
      {
        name: t('Ignored'),
        analyticsName: 'ignored',
        count: true,
        enabled: true,
        tooltipTitle: t(`Ignored issues don’t trigger alerts. When their ignore
        conditions are met they become Unresolved and are flagged for review.`),
      },
    ],
    [
      Query.REPROCESSING,
      {
        name: t('Reprocessing'),
        analyticsName: 'reprocessing',
        count: true,
        enabled: organization.features.includes('reprocessing-v2'),
        tooltipTitle: tct(
          `These [link:reprocessing issues] will take some time to complete.
        Any new issues that are created during reprocessing will be flagged for review.`,
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/error-monitoring/reprocessing/" />
            ),
          }
        ),
        tooltipHoverable: true,
      },
    ],
  ];

  return tabs.filter(([_query, tab]) => tab.enabled);
}

/**
 * @returns queries that should have counts fetched
 */
export function getTabsWithCounts(organization: Organization) {
  const tabs = getTabs(organization);
  return tabs.filter(([_query, tab]) => tab.count).map(([query]) => query);
}

export function isForReviewQuery(query: string | undefined) {
  return (
    query !== undefined &&
    (query === Query.FOR_REVIEW || query === Query.FOR_REVIEW_OWNER)
  );
}

// the tab counts will look like 99+
export const TAB_MAX_COUNT = 99;

type QueryCount = {
  count: number;
  hasMore: boolean;
};

export type QueryCounts = Partial<Record<Query, QueryCount>>;

export enum IssueSortOptions {
  DATE = 'date',
  NEW = 'new',
  PRIORITY = 'priority',
  FREQ = 'freq',
  USER = 'user',
  TREND = 'trend',
  INBOX = 'inbox',
}

export function getSortLabel(key: string) {
  switch (key) {
    case IssueSortOptions.NEW:
      return t('First Seen');
    case IssueSortOptions.PRIORITY:
      return t('Priority');
    case IssueSortOptions.FREQ:
      return t('Events');
    case IssueSortOptions.USER:
      return t('Users');
    case IssueSortOptions.TREND:
      return t('Relative Change');
    case IssueSortOptions.INBOX:
      return t('Date Added');
    case IssueSortOptions.DATE:
    default:
      return t('Last Seen');
  }
}
