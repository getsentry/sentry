import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconList} from 'sentry/icons';
import {t} from 'sentry/locale';
import {percent} from 'sentry/utils';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {TagBar} from 'sentry/views/issueDetails/groupTags/tagDistribution';

import {
  getLogAttributeUrl,
  getLogPageFilters,
  LOG_AGGREGATE_WINDOW_MS,
  LOG_EMBED_REFERRER,
  toDateQueryParams,
  type LogEmbedIdentity,
} from './logUtils';

const COUNT = 'count()';
const TOP_VALUE_COUNT = 5;

/**
 * The aggregates endpoint returns one row per group, keyed by the attribute
 * that was grouped on, so the row shape isn't known until runtime.
 */
interface LogAttributeAggregates {
  data: Array<Record<string, string | number | null>>;
}

interface LogAttributeViewProps {
  attribute: string;
  identity: LogEmbedIdentity;
}

/**
 * Logs have no attribute-distribution endpoint of their own -- the trace item
 * stats endpoint only serves spans and occurrences -- so break the attribute
 * down with a plain aggregate logs query instead.
 */
export function LogAttributeView({attribute, identity}: LogAttributeViewProps) {
  const organization = useOrganization();
  const selection = useMemo(
    () => getLogPageFilters(identity, LOG_AGGREGATE_WINDOW_MS),
    [identity]
  );

  const {data, isError, isPending} = useQuery({
    ...apiOptions.as<LogAttributeAggregates>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: DiscoverDatasets.OURLOGS,
          field: [attribute, COUNT],
          orderby: `-${COUNT}`,
          per_page: TOP_VALUE_COUNT,
          project: selection.projects,
          environment: selection.environments,
          sampling: SAMPLING_MODE.NORMAL,
          referrer: LOG_EMBED_REFERRER,
          ...toDateQueryParams(selection),
        },
        staleTime: 30_000,
      }
    ),
    retry: false,
  });

  const rows = data?.data ?? [];
  const total = rows.reduce((sum, row) => sum + Number(row[COUNT] ?? 0), 0);

  return (
    <Stack data-test-id="seer-log-attribute-breakdown" gap="sm">
      <Flex align="center" gap="md" justify="between" wrap="wrap">
        <Text bold size="xs" uppercase variant="muted">
          {attribute}
        </Text>
        <ResourceLink
          icon={IconList}
          href={getLogAttributeUrl({organization, attribute, ...identity})}
          title={t('Break down in Explore')}
        />
      </Flex>
      {isPending ? (
        <Flex justify="center" padding="md">
          <LoadingIndicator mini />
        </Flex>
      ) : isError ? (
        <Text variant="danger">{t('Unable to load attribute breakdown')}</Text>
      ) : rows.length === 0 ? (
        <Text variant="muted">{t('No logs with this attribute nearby')}</Text>
      ) : (
        <Stack gap="xs">
          {rows.map((row, index) => {
            const value = row[attribute];
            const count = Number(row[COUNT] ?? 0);
            const share = percent(count, total);

            return (
              <Grid
                key={`${String(value)}-${index}`}
                align="center"
                columns="minmax(0, 1fr) auto"
                gap="md"
              >
                <Text ellipsis monospace size="sm">
                  {value === null || value === '' ? t('(empty)') : String(value)}
                </Text>
                <Flex align="center" gap="sm" width="140px">
                  <Text size="sm" tabular variant="muted">
                    {share < 1 ? t('<1%') : `${Math.round(share)}%`}
                  </Text>
                  <TagBar percentage={share} />
                </Flex>
              </Grid>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
