import {useMemo} from 'react';

import {QueryEmbedCard} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedCard';
import {QUERY_EMBED_ROW_LIMIT} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedConstants';
import {QueryEmbedIssueList} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedIssueList';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getIssuesQueryHref} from './issuesQueryLink';

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
      table={
        <QueryEmbedIssueList
          query={data.query}
          queryParams={queryParams}
          source="seer-issues-query-embed"
        />
      }
      testId="seer-issues-query-embed"
      title={data.title ?? t('Issue search')}
    />
  );
}
