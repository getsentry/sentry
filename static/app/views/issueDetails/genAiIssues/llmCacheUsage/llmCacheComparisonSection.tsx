import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {t, tn} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {LlmCacheEvidenceData} from './types';
import {useCallSitePageFilters} from './useCallSitePageFilters';
import {
  buildCallSiteQuery,
  formatCallSiteLabel,
  formatRate,
  formatTokens,
  getCallSiteExploreUrl,
} from './utils';

interface LlmCacheComparisonSectionProps {
  evidenceData: LlmCacheEvidenceData;
}

interface CallSiteColumnProps {
  avgInputTokens: number | null;
  callCount: number | null;
  exploreUrl: string | undefined;
  heading: string;
  hitRate: number | null;
  label: string;
  variant: 'danger' | 'success';
}

function formatCallVolume(callCount: number, avgInputTokens: number | null): string {
  const calls = tn('%s call', '%s calls', callCount);
  if (avgInputTokens === null) {
    return calls;
  }
  return t('%s · %s avg tokens', calls, formatTokens(avgInputTokens));
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
  const callSite = (
    <Text monospace size="sm">
      {label}
    </Text>
  );

  return (
    <Stack gap="xs">
      <Text size="sm" variant="muted" uppercase>
        {heading}
      </Text>
      {exploreUrl ? <Link to={exploreUrl}>{callSite}</Link> : callSite}
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
          {formatCallVolume(callCount, avgInputTokens)}
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
  // The two columns are only comparable over the period the finding measured.
  const selection = useCallSitePageFilters(evidenceData);
  const {anchor} = evidenceData;

  if (anchor === null) {
    return null;
  }

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
          label={formatCallSiteLabel(evidenceData)}
          hitRate={evidenceData.hitRate}
          callCount={evidenceData.callCount}
          avgInputTokens={evidenceData.avgInputTokens}
          exploreUrl={getCallSiteExploreUrl({
            organization,
            selection,
            query: buildCallSiteQuery(evidenceData),
          })}
          variant="danger"
        />
        <CallSiteColumn
          heading={t('Caching normally')}
          label={formatCallSiteLabel(anchor)}
          hitRate={anchor.hitRate}
          callCount={anchor.callCount}
          avgInputTokens={anchor.avgInputTokens}
          exploreUrl={getCallSiteExploreUrl({
            organization,
            selection,
            query: buildCallSiteQuery(anchor),
          })}
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
