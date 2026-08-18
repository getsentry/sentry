import {KeyValueData} from 'sentry/components/keyValueData';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanFields} from 'sentry/views/insights/types';

import {CallSiteMetric} from './callSiteMetric';
import type {LlmCacheEvidenceData} from './types';
import {useCallSitePageFilters} from './useCallSitePageFilters';
import {buildCallSiteQuery, formatUsd, LLM_CACHE_REFERRER} from './utils';

const INPUT_COST_FIELD = `sum(${SpanFields.GEN_AI_COST_INPUT_TOKENS})` as const;

interface LlmCacheActualSpendProps {
  evidenceData: LlmCacheEvidenceData;
}

/**
 * What the call site actually spent on input tokens over the window.
 *
 * The avoidable figure beside it is an estimate; anchoring it against real
 * billed spend is what makes it credible. Renders nothing when the pipeline
 * never priced these spans, which is the case for models the metadata feed
 * does not know.
 */
export function LlmCacheActualSpend({evidenceData}: LlmCacheActualSpendProps) {
  const pageFilters = useCallSitePageFilters(evidenceData);
  const query = buildCallSiteQuery(evidenceData);

  const {data, isPending, isError} = useSpans(
    {
      fields: [INPUT_COST_FIELD],
      search: query ?? undefined,
      pageFilters,
      limit: 1,
      enabled: query !== null && pageFilters !== undefined,
    },
    LLM_CACHE_REFERRER
  );

  if (query === null || pageFilters === undefined || isError) {
    return null;
  }

  if (isPending) {
    return (
      <KeyValueData.Content
        disableFormattedData
        item={{
          key: 'actual-spend',
          subject: t('Spend'),
          value: <Placeholder height="1rem" width="80px" />,
        }}
      />
    );
  }

  const spend = data?.[0]?.[INPUT_COST_FIELD];
  if (typeof spend !== 'number' || spend <= 0) {
    return null;
  }

  return (
    <CallSiteMetric
      id="actual-spend"
      label={t('Spend')}
      value={formatUsd(spend)}
      tooltip={t(
        'Input-token spend recorded for this call site over the detection window.'
      )}
    />
  );
}
