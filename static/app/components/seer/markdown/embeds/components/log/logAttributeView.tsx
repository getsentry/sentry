import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {EmbedSection} from 'sentry/components/seer/markdown/embeds/components/embedSection';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconList} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {TagDistributionPanel} from 'sentry/views/issueDetails/groupTags/tagDistribution';

import {
  getLogAttributeUrl,
  getLogPageFilters,
  LOG_AGGREGATE_WINDOW_MS,
  LOG_EMBED_REFERRER,
  toDateQueryParams,
  type LogEmbedIdentity,
} from './logUtils';

const COUNT = 'count()';

/**
 * How many groups the query asks for. Far more than the panel draws -- the
 * surplus rows never render, but they are what makes each share a portion of
 * everything nearby rather than a portion of whatever happened to fit, and what
 * gives the remainder the panel folds into "Other" a real size.
 *
 * Deliberately not a second, ungrouped `count()` query the way the issue tag
 * distribution gets its total: the two are sampled independently, so that total
 * comes back disagreeing with the groups it is supposed to contain -- smaller
 * than their sum often enough to render a negative remainder.
 */
const AGGREGATE_ROW_LIMIT = 50;

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
 * How one attribute is distributed across the logs around this one. Logs have
 * no attribute-distribution endpoint of their own -- the trace item stats
 * endpoint only serves spans and occurrences -- so break the attribute down with
 * a plain aggregate logs query instead, then render it through the same panel
 * the event embed uses for a tag.
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
          per_page: AGGREGATE_ROW_LIMIT,
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
  const values = rows.map(row => {
    const value = row[attribute];
    return {
      count: Number(row[COUNT] ?? 0),
      value: value === null || value === undefined ? '' : String(value),
    };
  });
  const totalValues = values.reduce((sum, value) => sum + value.count, 0);

  return (
    <EmbedSection
      title={t('Attribute Distribution')}
      action={
        <ResourceLink
          icon={IconList}
          href={getLogAttributeUrl({organization, attribute, ...identity})}
          title={t('Break down in Explore')}
        />
      }
    >
      {isPending ? (
        <Flex justify="center" padding="md">
          <LoadingIndicator mini />
        </Flex>
      ) : isError ? (
        <Text variant="muted">{t('Unable to load values for %s', attribute)}</Text>
      ) : values.length === 0 ? (
        <Text variant="muted">{t('No logs with this attribute nearby')}</Text>
      ) : (
        <Container data-test-id="seer-log-attribute-breakdown" width="100%">
          <TagDistributionPanel
            formatCount={(count, total) =>
              tct('[count] of [total] nearby logs', {
                count: count.toLocaleString(),
                total: total.toLocaleString(),
              })
            }
            title={attribute}
            totalValues={totalValues}
            values={values}
          />
        </Container>
      )}
    </EmbedSection>
  );
}
