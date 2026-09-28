import {lazy, useMemo} from 'react';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {QueryEmbedCard} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedCard';
import {QUERY_EMBED_ROW_LIMIT} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedConstants';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getIssuesQueryHref} from './issuesQueryLink';

const LazyGroupList = lazy(async () => {
  const {GroupList} = await import('sentry/components/issues/groupList');
  return {default: GroupList};
});

const PREVIEW_COLUMNS: GroupListColumn[] = [
  'graph',
  'firstSeen',
  'lastSeen',
  'event',
  'priority',
  'assigneeAvatar',
];

export default function IssuesQueryBlock({data}: {data: EmbedOutput<'issuesQuery'>}) {
  const organization = useOrganization();
  const queryParams = useMemo(
    () => ({
      query: data.query,
      sort: data.sort,
      project: data.projects?.map(String),
      environment: data.environments,
      statsPeriod: data.statsPeriod,
      start: data.start,
      end: data.end,
      limit: QUERY_EMBED_ROW_LIMIT,
    }),
    [data]
  );

  return (
    <QueryEmbedCard
      href={getIssuesQueryHref(data, organization.slug)}
      icon={IconIssues}
      linkLabel={t('View Issues')}
      query={data.query}
      testId="seer-issues-query-embed"
      title={data.title ?? t('Issue search')}
    >
      <ErrorBoundary mini>
        <LazyLoad
          LazyComponent={LazyGroupList}
          canSelectGroups={false}
          numPlaceholderRows={3}
          query={data.query}
          queryParams={queryParams}
          source="seer-issues-query-embed"
          staleTime={30_000}
          useFilteredStats
          withChart
          withColumns={PREVIEW_COLUMNS}
          withPagination={false}
        />
      </ErrorBoundary>
    </QueryEmbedCard>
  );
}
