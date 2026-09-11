import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {QueryEmbedCard} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedCard';
import {TimeSince} from 'sentry/components/timeSince';
import {IconStar} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getSavedQueryDatasetLabel,
  useGetSavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {getSavedQueryTraceItemUrl} from 'sentry/views/explore/utils';

import {SavedQueryLink, type SavedQueryData} from './savedQueryLink';

export default function SavedQueryBlock({data}: {data: SavedQueryData}) {
  const organization = useOrganization();
  const {data: savedQuery, isLoading} = useGetSavedQuery(data.id);

  if (isLoading) {
    return (
      <Flex align="center" justify="center" padding="xl" width="100%">
        <LoadingIndicator />
      </Flex>
    );
  }

  // A saved query that can't be loaded — deleted, or not visible to this
  // viewer — still has a name and a dataset from the tag, so fall back to the
  // inline link rather than rendering an empty card.
  if (!savedQuery) {
    return <SavedQueryLink data={data} />;
  }

  // Multi-query saved queries exist but only Explore's compare mode renders
  // them; the saved-queries table shows the first and so does this. The link
  // still resolves to the compare view, which is what the URL builder does.
  const query = savedQuery.query[0];
  const yAxes = query.visualize.flatMap(visualize => visualize.yAxes);

  return (
    <QueryEmbedCard
      badge={
        // Trust the dataset the API reports over the one the tag claimed.
        <Tag variant="muted">{getSavedQueryDatasetLabel(savedQuery.dataset)}</Tag>
      }
      href={getSavedQueryTraceItemUrl({savedQuery, organization})}
      icon={IconStar}
      linkLabel={t('View Query')}
      query={query.query}
      testId="seer-saved-query-embed"
      title={savedQuery.name}
    >
      {query.groupby.length > 0 || yAxes.length > 0 ? (
        <Flex align="center" gap="md" wrap="wrap">
          {query.groupby.length > 0 ? (
            <Flex align="center" gap="xs" wrap="wrap">
              <Text size="sm" variant="muted">
                {t('Group by')}
              </Text>
              {query.groupby.map(groupBy => (
                <Tag key={groupBy} variant="info">
                  {groupBy}
                </Tag>
              ))}
            </Flex>
          ) : null}
          {yAxes.length > 0 ? (
            <Flex align="center" gap="xs" wrap="wrap">
              <Text size="sm" variant="muted">
                {t('Visualize')}
              </Text>
              {yAxes.map(yAxis => (
                <Tag key={yAxis} variant="info">
                  {yAxis}
                </Tag>
              ))}
            </Flex>
          ) : null}
        </Flex>
      ) : null}
      <Text size="sm" variant="muted">
        {savedQuery.createdBy?.name
          ? tct('Updated [time] by [name]', {
              time: <TimeSince date={savedQuery.dateUpdated} />,
              name: savedQuery.createdBy.name,
            })
          : tct('Updated [time]', {
              time: <TimeSince date={savedQuery.dateUpdated} />,
            })}
      </Text>
    </QueryEmbedCard>
  );
}
