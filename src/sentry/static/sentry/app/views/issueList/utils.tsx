import {t} from 'app/locale';
import {Organization} from 'app/types';

export enum Query {
  NEEDS_REVIEW = 'is:unresolved is:needs_review',
  NEEDS_REVIEW_OWNER = 'is:unresolved is:needs_review owner:me_or_none',
  UNRESOLVED = 'is:unresolved',
  IGNORED = 'is:ignored',
  REPROCESSING = 'is:reprocessing',
}

type OverviewTab = {
  name: string;
  /** Will fetch a count to display on this tab */
  count: boolean;
  /** Tabs can be disabled via flag */
  enabled: boolean;
};

export function getTabs(organization: Organization) {
  const tabs: Array<[string, OverviewTab]> = [
    [
      Query.NEEDS_REVIEW_OWNER,
      {
        name: t('Needs Review'),
        count: true,
        enabled: organization.features.includes('inbox-owners-query'),
      },
    ],
    [
      Query.NEEDS_REVIEW,
      {
        name: t('Needs Review'),
        count: true,
        enabled: !organization.features.includes('inbox-owners-query'),
      },
    ],
    [
      Query.UNRESOLVED,
      {
        name: t('All Unresolved'),
        count: true,
        enabled: true,
      },
    ],
    [
      Query.IGNORED,
      {
        name: t('Ignored'),
        count: false,
        enabled: true,
      },
    ],
    [
      Query.REPROCESSING,
      {
        name: t('Reprocessing'),
        count: false,
        enabled: organization.features.includes('reprocessing-v2'),
      },
    ],
  ];

  return tabs.filter(pair => pair[1].enabled);
}

// These tabs will have the counts displayed
export function getTabsWithCounts(organization: Organization) {
  const tabs = getTabs(organization);
  return tabs.filter(([_, value]) => value.count).map(([key]) => key);
}

// the tab counts will look like 99+
export const TAB_MAX_COUNT = 99;

type QueryCount = {
  count: number;
  hasMore: boolean;
};
export type QueryCounts = Partial<Record<Query, QueryCount>>;
