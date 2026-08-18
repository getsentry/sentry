import type {ReactNode} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {InfoTip} from '@sentry/scraps/info';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {KeyValueData} from 'sentry/components/keyValueData';
import {t, tct, tn} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {CallSiteMetric} from './callSiteMetric';
import {LlmCacheActualSpend} from './llmCacheActualSpend';
import {LlmCacheTokenBar} from './llmCacheTokenBar';
import type {LlmCacheEvidenceData} from './types';
import {useCallSitePageFilters} from './useCallSitePageFilters';
import {
  buildCallSiteQuery,
  formatCallSiteLabel,
  formatRate,
  formatTokens,
  formatUsd,
  formatWriteReadRatio,
  getCallSiteExploreUrl,
  usesOperationNameFallback,
} from './utils';

interface LlmCacheProblemSectionProps {
  evidenceData: LlmCacheEvidenceData;
}

/**
 * Every sentence below supplies the article, so this has to read as a bare
 * noun: "over the last the detection window" otherwise.
 */
function getWindowLabel(windowDays: number | null): string {
  return windowDays === null
    ? t('detection window')
    : tn('%s day', '%s days', windowDays);
}

function thrashStatement(evidenceData: LlmCacheEvidenceData): ReactNode {
  const {estimatedSavingsUsd, sumCacheCreationTokens, windowDays} = evidenceData;
  const windowLabel = getWindowLabel(windowDays);

  if (estimatedSavingsUsd !== null) {
    return tct(
      'This call site keeps paying to write the prompt cache but rarely reads it back — something near the start of the prompt changes between calls and invalidates the cached prefix. A stable prefix could have saved about [savings] over the last [window].',
      {
        savings: <Text bold>{formatUsd(estimatedSavingsUsd)}</Text>,
        window: windowLabel,
      }
    );
  }
  // Without a quantity there is no clause to put it in: naming the shape of the
  // problem beats reporting that its size is "Unknown".
  if (sumCacheCreationTokens === null) {
    return t(
      'This call site keeps paying to write the prompt cache but rarely reads it back — something near the start of the prompt changes between calls and invalidates the cached prefix.'
    );
  }
  return tct(
    'This call site keeps paying to write the prompt cache but rarely reads it back — something near the start of the prompt changes between calls and invalidates the cached prefix. Over the last [window], [tokens] of cache writes were never paid back by reads.',
    {
      tokens: <Text bold>{formatTokens(sumCacheCreationTokens)}</Text>,
      window: windowLabel,
    }
  );
}

function notCachingStatement(evidenceData: LlmCacheEvidenceData): ReactNode {
  const {estimatedSavingsUsd, sumInputTokens, uncachedTokens, windowDays} = evidenceData;
  const windowLabel = getWindowLabel(windowDays);

  if (estimatedSavingsUsd !== null && sumInputTokens !== null) {
    return tct(
      'Sentry found an LLM call site that almost never hits the prompt cache. Over the last [window] it sent [tokens] of input at the full rate — caching the repeated part of the prompt could have saved up to [savings].',
      {
        window: windowLabel,
        tokens: <Text bold>{formatTokens(sumInputTokens)}</Text>,
        savings: <Text bold>{formatUsd(estimatedSavingsUsd)}</Text>,
      }
    );
  }
  if (uncachedTokens === null) {
    return t(
      'Sentry found an LLM call site that almost never hits the prompt cache, and cached input tokens typically cost a fraction of fresh ones.'
    );
  }
  return tct(
    'Sentry found an LLM call site that almost never hits the prompt cache. Over the last [window] it re-sent [tokens] that never came from cache, and cached input tokens typically cost a fraction of fresh ones.',
    {
      window: windowLabel,
      tokens: <Text bold>{formatTokens(uncachedTokens)}</Text>,
    }
  );
}

function ProblemStatement({evidenceData}: LlmCacheProblemSectionProps) {
  if (evidenceData.outcome === 'thrash') {
    return (
      <Stack gap="sm">
        <Text>{thrashStatement(evidenceData)}</Text>
        {evidenceData.overpayVsNoCacheUsd !== null && (
          <Text bold>{t('Right now, caching here costs more than turning it off.')}</Text>
        )}
      </Stack>
    );
  }

  return <Text>{notCachingStatement(evidenceData)}</Text>;
}

export function LlmCacheProblemSection({evidenceData}: LlmCacheProblemSectionProps) {
  const organization = useOrganization();
  const selection = useCallSitePageFilters(evidenceData);
  const {
    model,
    outcome,
    callCount,
    hitRate,
    writeReadRatio,
    avgInputTokens,
    estimatedSavingsUsd,
  } = evidenceData;

  const callSiteExploreUrl = getCallSiteExploreUrl({
    organization,
    selection,
    query: buildCallSiteQuery(evidenceData),
  });

  return (
    <Stack gap="lg">
      <Alert variant="muted" showIcon>
        <ProblemStatement evidenceData={evidenceData} />
      </Alert>
      <Grid columns="fit-content(50%) 1fr" border="primary" radius="md" padding="sm">
        <KeyValueData.Content
          disableFormattedData
          item={{
            action: callSiteExploreUrl ? {link: callSiteExploreUrl} : undefined,
            key: 'call-site',
            subject: t('Call site'),
            value: (
              <Flex align="center" gap="xs">
                <Text>{formatCallSiteLabel(evidenceData)}</Text>
                {usesOperationNameFallback(evidenceData.agentLabelSource) && (
                  <InfoTip
                    size="xs"
                    title={t(
                      'These spans carry no gen_ai.agent.name, so this call site is named after the operation instead. Calls from more than one agent can land here — set the agent name to split them apart.'
                    )}
                  />
                )}
              </Flex>
            ),
          }}
        />
        <KeyValueData.Content
          disableFormattedData
          item={{key: 'model', subject: t('Model'), value: model ?? t('Unknown')}}
        />
        <CallSiteMetric
          id="cache-hit-rate"
          label={t('Cache hit rate')}
          value={formatRate(hitRate)}
          emphasized={outcome === 'not_caching'}
          tooltip={t(
            'Share of input tokens served from the prompt cache over the detection window.'
          )}
        />
        <CallSiteMetric
          id="cache-write-read-ratio"
          label={t('Cache write:read ratio')}
          value={formatWriteReadRatio(writeReadRatio)}
          emphasized={outcome === 'thrash'}
          tooltip={t(
            'Cache writes bill at a premium over plain input tokens, and only pay for themselves once they are read back.'
          )}
        />
        <CallSiteMetric
          id="calls"
          label={t('Calls')}
          value={callCount === null ? t('Unknown') : callCount.toLocaleString()}
          tooltip={t(
            'Calls in the detection window. Only call sites busy enough to keep a cache warm are evaluated.'
          )}
        />
        <CallSiteMetric
          id="avg-input-tokens"
          label={t('Avg input tokens')}
          value={formatTokens(avgInputTokens)}
        />
        {estimatedSavingsUsd !== null && (
          <CallSiteMetric
            id="avoidable-spend"
            label={t('Avoidable spend')}
            value={formatUsd(estimatedSavingsUsd)}
            tooltip={t(
              'Estimated from current model prices for input, cache reads and cache writes. It assumes the repeated part of each prompt could be cached, so treat it as an upper bound.'
            )}
          />
        )}
        <LlmCacheActualSpend evidenceData={evidenceData} />
      </Grid>
      <LlmCacheTokenBar
        inputTokens={evidenceData.sumInputTokens}
        cacheReadTokens={evidenceData.sumCacheReadTokens}
        cacheCreationTokens={evidenceData.sumCacheCreationTokens}
      />
    </Stack>
  );
}
