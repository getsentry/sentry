import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

import type {LlmCacheEvidenceData, LlmCacheSampleCall} from './types';
import {formatTokens} from './utils';

interface LlmCacheExampleCallsProps {
  evidenceData: LlmCacheEvidenceData;
}

function SampleRow({sample}: {sample: LlmCacheSampleCall}) {
  const organization = useOrganization();
  const location = useLocation();

  const target = getTraceDetailsUrl({
    organization,
    traceSlug: sample.traceId,
    // The occurrence's own timestamp is detection time, days after the call, so
    // the trace can only be located by the sample's timestamp.
    timestamp: sample.timestamp ?? undefined,
    spanId: sample.spanId ?? undefined,
    dateSelection: {},
    location,
    source: TraceViewSources.ISSUE_DETAILS,
  });

  return (
    <Flex justify="between" align="center" gap="lg" wrap="wrap">
      {/* A row is one call, so it is named for the span that made it rather than
          for the trace around it, which holds the whole request. A sample with no
          span id can only offer that trace, and says which it is offering. */}
      <Link to={target}>
        {sample.spanId ? (
          <Text monospace size="sm">
            {sample.spanId}
          </Text>
        ) : (
          <Text size="sm">{t('View trace')}</Text>
        )}
      </Link>
      {sample.inputTokens !== null && (
        <Text size="sm" variant="muted">
          {t(
            '%s input · %s cached',
            formatTokens(sample.inputTokens),
            formatTokens(sample.cacheReadTokens ?? 0)
          )}
        </Text>
      )}
      {sample.timestamp && (
        <Text size="sm" variant="muted">
          <DateTime date={sample.timestamp} />
        </Text>
      )}
    </Flex>
  );
}

/**
 * A few of the call site's largest calls, as a way in to the raw request.
 *
 * Comparing two of them is the first troubleshooting step for thrash: whatever
 * differs near the start of the prompt is what invalidates the cached prefix.
 */
export function LlmCacheExampleCalls({evidenceData}: LlmCacheExampleCallsProps) {
  const {sampleCalls} = evidenceData;

  if (sampleCalls.length === 0) {
    return null;
  }

  return (
    <Stack gap="md">
      <Text size="sm" variant="muted">
        {t('The largest calls from this call site in the detection window.')}
      </Text>
      <Stack gap="sm" border="primary" radius="md" padding="md">
        {sampleCalls.map(sample => (
          <SampleRow key={sample.traceId} sample={sample} />
        ))}
      </Stack>
    </Stack>
  );
}
