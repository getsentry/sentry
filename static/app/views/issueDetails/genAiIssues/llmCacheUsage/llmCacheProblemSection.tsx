import {Alert} from '@sentry/scraps/alert';
import {InfoTip} from '@sentry/scraps/info';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {KeyValueData} from 'sentry/components/keyValueData';
import {t, tct, tn} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';

import {LlmCacheActualSpend} from './llmCacheActualSpend';
import {LlmCacheTokenBar} from './llmCacheTokenBar';
import type {LlmCacheEvidenceData} from './types';
import {useCallSitePageFilters} from './useCallSitePageFilters';
import {
  buildCallSiteQuery,
  formatRate,
  formatTokens,
  formatUsd,
  formatWriteReadRatio,
  LLM_CACHE_REFERRER,
} from './utils';

interface LlmCacheProblemSectionProps {
  evidenceData: LlmCacheEvidenceData;
}

function ProblemStatement({evidenceData}: LlmCacheProblemSectionProps) {
  const {outcome, estimatedSavingsUsd, sumInputTokens, uncachedTokens, windowDays} =
    evidenceData;
  // Every sentence below supplies the article, so this has to read as a bare
  // noun: "over the last the detection window" otherwise.
  const windowLabel =
    windowDays === null ? t('detection window') : tn('%s day', '%s days', windowDays);
  const priced = estimatedSavingsUsd !== null;

  if (outcome === 'thrash') {
    return (
      <Stack gap="sm">
        <Text>{thrashStatement()}</Text>
        {evidenceData.overpayVsNoCacheUsd !== null && (
          <Text bold>{t('Right now, caching here costs more than turning it off.')}</Text>
        )}
      </Stack>
    );
  }

  return <Text>{notCachingStatement()}</Text>;

  function thrashStatement() {
    if (priced) {
      return tct(
        'This call site keeps paying to write the prompt cache but rarely reads it back — something near the start of the prompt changes between calls and invalidates the cached prefix. A stable prefix could have saved about [savings] over the last [window].',
        {savings: <Text bold>{formatUsd(estimatedSavingsUsd)}</Text>, window: windowLabel}
      );
    }
    // Without a quantity there is no clause to put it in: naming the shape of
    // the problem beats reporting that its size is "Unknown".
    if (evidenceData.sumCacheCreationTokens === null) {
      return t(
        'This call site keeps paying to write the prompt cache but rarely reads it back — something near the start of the prompt changes between calls and invalidates the cached prefix.'
      );
    }
    return tct(
      'This call site keeps paying to write the prompt cache but rarely reads it back — something near the start of the prompt changes between calls and invalidates the cached prefix. Over the last [window], [tokens] of cache writes were never paid back by reads.',
      {
        tokens: <Text bold>{formatTokens(evidenceData.sumCacheCreationTokens)}</Text>,
        window: windowLabel,
      }
    );
  }

  function notCachingStatement() {
    if (priced && sumInputTokens !== null) {
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
      {window: windowLabel, tokens: <Text bold>{formatTokens(uncachedTokens)}</Text>}
    );
  }
}

export function LlmCacheProblemSection({evidenceData}: LlmCacheProblemSectionProps) {
  const organization = useOrganization();
  // Pinned to the detection window, like the page's other live queries: the
  // reader's own range would send them to an Explore view that answers a
  // different question than the issue is making a claim about.
  const selection = useCallSitePageFilters(evidenceData);
  const {
    transaction,
    spanDescription,
    model,
    outcome,
    callCount,
    hitRate,
    writeReadRatio,
    avgInputTokens,
    estimatedSavingsUsd,
  } = evidenceData;

  const callSiteQuery = buildCallSiteQuery({transaction, spanDescription, model});
  const callSiteExploreUrl =
    callSiteQuery && selection
      ? getExploreUrl({
          organization,
          selection,
          mode: Mode.SAMPLES,
          query: callSiteQuery,
          referrer: LLM_CACHE_REFERRER,
        })
      : undefined;

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
            value:
              [transaction, spanDescription].filter(Boolean).join(' | ') || t('Unknown'),
          }}
        />
        <KeyValueData.Content
          disableFormattedData
          item={{key: 'model', subject: t('Model'), value: model ?? t('Unknown')}}
        />
        <KeyValueData.Content
          disableFormattedData
          item={{
            key: 'cache-hit-rate',
            subject: t('Cache hit rate'),
            value: (
              <Flex align="center" gap="xs">
                <Text monospace bold={outcome === 'not_caching'}>
                  {formatRate(hitRate)}
                </Text>
                <InfoTip
                  size="xs"
                  title={t(
                    'Share of input tokens served from the prompt cache over the detection window.'
                  )}
                />
              </Flex>
            ),
          }}
        />
        <KeyValueData.Content
          disableFormattedData
          item={{
            key: 'cache-write-read-ratio',
            subject: t('Cache write:read ratio'),
            value: (
              <Flex align="center" gap="xs">
                <Text monospace bold={outcome === 'thrash'}>
                  {formatWriteReadRatio(writeReadRatio)}
                </Text>
                <InfoTip
                  size="xs"
                  title={t(
                    'Cache writes bill at a premium over plain input tokens, and only pay for themselves once they are read back.'
                  )}
                />
              </Flex>
            ),
          }}
        />
        <KeyValueData.Content
          disableFormattedData
          item={{
            key: 'calls',
            subject: t('Calls'),
            value: (
              <Flex align="center" gap="xs">
                <Text monospace>
                  {callCount === null ? t('Unknown') : callCount.toLocaleString()}
                </Text>
                <InfoTip
                  size="xs"
                  title={t(
                    'Calls in the detection window. Only call sites busy enough to keep a cache warm are evaluated.'
                  )}
                />
              </Flex>
            ),
          }}
        />
        <KeyValueData.Content
          disableFormattedData
          item={{
            key: 'avg-input-tokens',
            subject: t('Avg input tokens'),
            value: formatTokens(avgInputTokens),
          }}
        />
        {estimatedSavingsUsd !== null && (
          <KeyValueData.Content
            disableFormattedData
            item={{
              key: 'avoidable-spend',
              subject: t('Avoidable spend'),
              value: (
                <Flex align="center" gap="xs">
                  <Text monospace>{formatUsd(estimatedSavingsUsd)}</Text>
                  <InfoTip
                    size="xs"
                    title={t(
                      'Estimated from current model prices for input, cache reads and cache writes. It assumes the repeated part of each prompt could be cached, so treat it as an upper bound.'
                    )}
                  />
                </Flex>
              ),
            }}
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
