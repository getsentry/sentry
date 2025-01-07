import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import type {PageFilters} from 'sentry/types/core';
import {getUtcDateString} from 'sentry/utils/dates';
import theme from 'sentry/utils/theme';
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

  // TODO(msun): Once page filters are saved to views, remember to use the view's specific
  // page filters here instead of the global pageFilters, if they exist.
  const {data: queryCount, isFetching: queryCountFetching} = useFetchIssueCounts({
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
        backgroundColor: queryCountFetching
          ? [theme.gray100, theme.translucentSurface100, theme.gray100]
          : 'transparent',
      }}
      transition={{
        layout: {
          duration: 0.1,
        },
        default: {
          duration: 2.5,
          repeat: queryCountFetching ? Infinity : 0,
          ease: 'easeInOut',
        },
      }}
    >
      <motion.span
        layout="position"
        initial={{opacity: 0}}
        animate={{opacity: queryCountFetching ? 0 : 1}}
        transition={{duration: 0.1}}
      >
        {displayedCount > TAB_MAX_COUNT ? `${TAB_MAX_COUNT}+` : displayedCount}
      </motion.span>
    </QueryCountBubble>
  );
}

const QueryCountBubble = styled(motion.span)`
  line-height: 20px;
  font-size: 75%;
  padding: 0 5px;
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
