import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import {getUtcDateString} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {IssueView} from 'sentry/views/issueList/issueViews/issueViews';
import {useFetchIssueCounts} from 'sentry/views/issueList/queries/useFetchIssueCounts';

const TAB_MAX_COUNT = 99;

const constructCountTimeFrame = (
  pageFilters: PageFilters['datetime']
): {
  end?: string;
  start?: string;
  statsPeriod?: string;
} => {
  if (pageFilters.period) {
    return {statsPeriod: pageFilters.period};
  }
  return {
    ...(pageFilters.start ? {start: getUtcDateString(pageFilters.start)} : {}),
    ...(pageFilters.end ? {end: getUtcDateString(pageFilters.end)} : {}),
  };
};

interface IssueViewQueryCountProps {
  view: IssueView;
}

export function IssueViewQueryCount({view}: IssueViewQueryCountProps) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const theme = useTheme();

  // TODO(msun): Once page filters are saved to views, remember to use the view's specific
  // page filters here instead of the global pageFilters, if they exist.
  const {
    data: queryCount,
    isLoading,
    isFetching,
  } = useFetchIssueCounts({
    orgSlug: organization.slug,
    query: [view.unsavedChanges ? view.unsavedChanges[0] : view.query],
    project: pageFilters.selection.projects,
    environment: pageFilters.selection.environments,
    ...constructCountTimeFrame(pageFilters.selection.datetime),
  });

  const displayedCount =
    queryCount?.[view.unsavedChanges ? view.unsavedChanges[0] : view.query] ?? 0;

  return (
    <QueryCountBubble
      layout="size"
      animate={{
        backgroundColor: isFetching
          ? [theme.surface400, theme.surface100, theme.surface400]
          : `#00000000`,
      }}
      transition={{
        layout: {
          duration: 0.2,
        },
        default: {
          duration: 2,
          repeat: isFetching ? Infinity : 0,
          ease: 'easeInOut',
        },
      }}
    >
      <motion.span
        layout="position"
        initial={{opacity: isLoading ? 0 : 1}}
        animate={{opacity: isFetching ? 0 : 1}}
        transition={{duration: 0.15}}
      >
        {displayedCount > TAB_MAX_COUNT ? `${TAB_MAX_COUNT}+` : displayedCount}
      </motion.span>
    </QueryCountBubble>
  );
}

const QueryCountBubble = styled(motion.span)`
  line-height: 20px;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: 0 ${space(0.5)};
  min-width: 20px;
  display: flex;
  height: 16px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 1px solid ${p => p.theme.gray200};
  color: ${p => p.theme.gray300};
  margin-left: 0;
`;
