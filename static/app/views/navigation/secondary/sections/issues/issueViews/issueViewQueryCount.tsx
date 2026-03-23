import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Text} from '@sentry/scraps/text';

import type {PageFilters} from 'sentry/types/core';
import {getUtcDateString} from 'sentry/utils/dates';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {createIssueViewFromUrl} from 'sentry/views/issueList/issueViews/createIssueViewFromUrl';
import {useFetchIssueCounts} from 'sentry/views/issueList/queries/useFetchIssueCounts';
import type {IssueView} from 'sentry/views/navigation/secondary/sections/issues/issueViews/issueViews';

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
  const location = useLocation();

  const queryIssueViewParams = createIssueViewFromUrl({query: location.query});

  const {
    data: queryCount,
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

  if (isFetching) {
    return null;
  }

  return (
    <StyledTag variant="muted" data-issue-view-query-count>
      <Text variant="muted" size="xs" align="center" tabular>
        {count > TAB_MAX_COUNT ? `${TAB_MAX_COUNT}+` : count}
      </Text>
    </StyledTag>
  );
}
const StyledTag = styled(Tag)`
  border: 1px solid ${p => p.theme.tokens.border.neutral.muted};
  background-color: ${p => p.theme.tokens.background.primary};
  padding: 0 ${p => p.theme.space.xs};
  justify-content: end;

  opacity: 0;
  transform: scale(0.95);

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  animation: fadeIn 0.1s ease-in-out forwards;
`;
