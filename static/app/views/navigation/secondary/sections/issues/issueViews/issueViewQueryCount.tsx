import type {PageFilterDatetime} from 'sentry/types/core';
import {getUtcDateString} from 'sentry/utils/dates';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {createIssueViewFromUrl} from 'sentry/views/issueList/issueViews/createIssueViewFromUrl';
import {useFetchIssueCounts} from 'sentry/views/issueList/queries/useFetchIssueCounts';
import {IssueCount} from 'sentry/views/navigation/secondary/sections/issues/issueCount';
import type {IssueView} from 'sentry/views/navigation/secondary/sections/issues/issueViews/issueViews';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

const constructCountTimeFrame = (
  timeFilters: PageFilterDatetime
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

function IssueViewQueryCountImpl({view, isActive}: IssueViewQueryCountProps) {
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

  useLLMContext({
    contextHint: 'The live issue count for one starred issue view.',
    viewId: view.id,
    viewLabel: view.label,
    issueCount: isFetching ? null : count,
  });

  if (isFetching) {
    return null;
  }

  return <IssueCount count={count} />;
}

export const IssueViewQueryCount = registerLLMContext(
  'navigation',
  IssueViewQueryCountImpl
);
