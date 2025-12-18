import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import {getUtcDateString} from 'sentry/utils/dates';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {createIssueViewFromUrl} from 'sentry/views/issueList/issueViews/createIssueViewFromUrl';
import {useFetchIssueCounts} from 'sentry/views/issueList/queries/useFetchIssueCounts';
import type {IssueView} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViews';

const TAB_MAX_COUNT = 99;

const constructCountTimeFrame = (
  timeFilters: PageFilters['datetime']
): {
  end?: string;
  start?: string;
  statsPeriod?: string;
} => {
  if (timeFilters.period) {
    return {statsPeriod: timeFilters.period};
  }
  return {
    ...(timeFilters.start ? {start: getUtcDateString(timeFilters.start)} : {}),
    ...(timeFilters.end ? {end: getUtcDateString(timeFilters.end)} : {}),
    ...(timeFilters.utc ? {utc: timeFilters.utc} : {}),
  };
};

interface IssueViewQueryCountProps {
  isActive: boolean;
  view: IssueView;
}

export function IssueViewQueryCount({view, isActive}: IssueViewQueryCountProps) {
  const organization = useOrganization();
  const theme = useTheme();
  const location = useLocation();

  const queryIssueViewParams = createIssueViewFromUrl({query: location.query});

  const {
    data: queryCount,
    isLoading,
    isFetching,
    isError,
  } = useFetchIssueCounts({
    orgSlug: organization.slug,
    query: [isActive ? queryIssueViewParams.query : view.query],
    project: isActive ? queryIssueViewParams.projects : view.projects,
    environment: isActive ? queryIssueViewParams.environments : view.environments,
    ...constructCountTimeFrame(
      isActive ? queryIssueViewParams.timeFilters : view.timeFilters
    ),
  });

  // The endpoint's response type looks like this: { <query1>: <count>, <query2>: <count> }
  // But this component only ever sends one query, so we can just get the count of the first key.
  // This is a bit hacky, but it avoids having to use a state to store the previous query
  // when the query changes and the new data is still being fetched.
  const defaultQuery =
    Object.keys(queryCount ?? {}).length > 0
      ? Object.keys(queryCount ?? {})[0]
      : undefined;
  const count = isError
    ? 0
    : (queryCount?.[view.query] ?? queryCount?.[defaultQuery ?? ''] ?? 0);

  return (
    <QueryCountBubble
      animate={{
        backgroundColor: isFetching
          ? [theme.colors.surface500, theme.colors.surface200, theme.colors.surface500]
          : `#00000000`,
      }}
      transition={{
        default: {
          // Cuts animation short once the query has finished fetching
          duration: isFetching ? 2 : 0,
          repeat: isFetching ? Infinity : 0,
          ease: 'easeInOut',
        },
      }}
      data-issue-view-query-count
    >
      <motion.span
        // Prevents count from fading in if it's already cached on mount
        initial={{opacity: isLoading ? 0 : 1}}
        animate={{opacity: isFetching ? 0 : 1}}
      >
        {count > TAB_MAX_COUNT ? `${TAB_MAX_COUNT}+` : count}
      </motion.span>
    </QueryCountBubble>
  );
}

const QueryCountBubble = styled(motion.span)`
  line-height: 20px;
  font-size: ${p => p.theme.fontSize.xs};
  padding: 0 ${space(0.5)};
  min-width: 20px;
  display: flex;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 1px solid ${p => p.theme.border};
  color: ${p => p.theme.subText};
  margin-left: 0;
  font-weight: ${p => p.theme.fontWeight.bold};
`;
