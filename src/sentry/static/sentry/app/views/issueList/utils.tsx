import {t} from 'app/locale';
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
  tooltip: string;
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
        tooltip: t(`All unresolved issues, including those that need review.
        If an issue doesn’t occur for seven days it’s automatically resolved.`),
      },
    ],
    [
      Query.FOR_REVIEW_OWNER,
      {
        name: t('For Review'),
        analyticsName: 'needs_review',
        count: true,
        enabled: organization.features.includes('inbox-owners-query'),
        tooltip: t(`New and reopened issues. You can review, ignore, or resolve
        to move them out of this list. After seven days these issues are
        automatically marked as reviewed.`),
      },
    ],
    [
      Query.FOR_REVIEW,
      {
        name: t('For Review'),
        analyticsName: 'needs_review',
        count: true,
        enabled: !organization.features.includes('inbox-owners-query'),
        tooltip: t(`New and reopened issues. You can review, ignore, or resolve
        to move them out of this list. After seven days these issues are
        automatically marked as reviewed.`),
      },
    ],
    [
      Query.IGNORED,
      {
        name: t('Ignored'),
        analyticsName: 'ignored',
        count: true,
        enabled: true,
        tooltip: t(`Ignored issues don’t trigger alerts. When their ignore
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
        tooltip: '',
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

// the tab counts will look like 99+
export const TAB_MAX_COUNT = 99;

type QueryCount = {
  count: number;
  hasMore: boolean;
};

export type QueryCounts = Partial<Record<Query, QueryCount>>;
