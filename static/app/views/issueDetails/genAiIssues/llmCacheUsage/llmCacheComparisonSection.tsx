import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';

import type {LlmCacheEvidenceData} from './types';
import {buildCallSiteQuery, formatRate, formatTokens, LLM_CACHE_REFERRER} from './utils';

interface LlmCacheComparisonSectionProps {
  evidenceData: LlmCacheEvidenceData;
}

interface CallSiteColumnProps {
  callCount: number | null;
  exploreUrl: string | undefined;
  heading: string;
  hitRate: number | null;
  label: string;
  variant: 'danger' | 'success';
  avgInputTokens?: number | null;
}

function CallSiteColumn({
  heading,
  label,
  hitRate,
  callCount,
  avgInputTokens,
  exploreUrl,
  variant,
}: CallSiteColumnProps) {
  return (
    <Stack gap="xs">
      <Text size="sm" variant="muted" uppercase>
        {heading}
      </Text>
      {exploreUrl ? (
        <Link to={exploreUrl}>
          <Text monospace size="sm">
            {label}
          </Text>
        </Link>
      ) : (
        <Text monospace size="sm">
          {label}
        </Text>
      )}
      <Flex align="baseline" gap="sm">
        <Text size="xl" bold variant={variant}>
          {formatRate(hitRate)}
        </Text>
        <Text size="sm" variant="muted">
          {t('cache hit rate')}
        </Text>
      </Flex>
      {callCount !== null && (
        <Text size="sm" variant="muted">
          {avgInputTokens === null || avgInputTokens === undefined
            ? t('%s calls', callCount.toLocaleString())
            : t(
                '%s calls · %s avg tokens',
                callCount.toLocaleString(),
                formatTokens(avgInputTokens)
              )}
        </Text>
      )}
    </Stack>
  );
}

/**
 * The finding's rebuttal to "maybe this model just doesn't cache well here":
 * another call site on the same model, in the same project, caching fine.
 */
export function LlmCacheComparisonSection({
  evidenceData,
}: LlmCacheComparisonSectionProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {anchor} = evidenceData;

  if (anchor === null) {
    return null;
  }

  const toExploreUrl = (query: string | null) =>
    query
      ? getExploreUrl({
          organization,
          selection,
          mode: Mode.SAMPLES,
          query,
          referrer: LLM_CACHE_REFERRER,
        })
      : undefined;

  return (
    <Stack gap="md">
      <Grid
        columns={{xs: '1fr', sm: '1fr 1fr'}}
        gap="xl"
        border="primary"
        radius="md"
        padding="lg"
      >
        <CallSiteColumn
          heading={t('This call site')}
          label={[evidenceData.transaction, evidenceData.spanDescription]
            .filter(Boolean)
            .join(' | ')}
          hitRate={evidenceData.hitRate}
          callCount={evidenceData.callCount}
          avgInputTokens={evidenceData.avgInputTokens}
          exploreUrl={toExploreUrl(buildCallSiteQuery(evidenceData))}
          variant="danger"
        />
        <CallSiteColumn
          heading={t('Caching normally')}
          label={[anchor.transaction, anchor.spanDescription].filter(Boolean).join(' | ')}
          hitRate={anchor.hitRate}
          callCount={anchor.callCount}
          avgInputTokens={anchor.avgInputTokens}
          exploreUrl={toExploreUrl(
            buildCallSiteQuery({
              transaction: anchor.transaction,
              spanDescription: anchor.spanDescription,
              model: anchor.model,
            })
          )}
          variant="success"
        />
      </Grid>
      <Text size="sm" variant="muted">
        {t(
          'Both call sites run %s in this project. The difference is how each one builds its prompt.',
          anchor.model
        )}
      </Text>
    </Stack>
  );
}
