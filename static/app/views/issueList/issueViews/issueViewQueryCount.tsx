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
    isError,
  } = useFetchIssueCounts({
    orgSlug: organization.slug,
    query: [view.unsavedChanges ? view.unsavedChanges[0] : view.query],
    project: pageFilters.selection.projects,
    environment: pageFilters.selection.environments,
    ...constructCountTimeFrame(pageFilters.selection.datetime),
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
    : queryCount?.[view.unsavedChanges ? view.unsavedChanges[0] : view.query] ??
      queryCount?.[defaultQuery ?? ''] ??
      0;

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
          // Cuts animation short once the query has finished fetching
          duration: isFetching ? 2 : 0,
          repeat: isFetching ? Infinity : 0,
          ease: 'easeInOut',
        },
      }}
    >
      <motion.span
        // Prevents count from fading in if it's already cached on mount
        layout="preserve-aspect"
        initial={{opacity: isLoading ? 0 : 1}}
        animate={{opacity: isFetching ? 0 : 1}}
        transition={{duration: 0.1}}
      >
        {count > TAB_MAX_COUNT ? `${TAB_MAX_COUNT}+` : count}
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
