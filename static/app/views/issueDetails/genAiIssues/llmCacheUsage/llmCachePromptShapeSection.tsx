import type {ReactNode} from 'react';

import {Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tct, tn} from 'sentry/locale';

import {CallSiteMetric} from './callSiteMetric';
import type {LlmCacheEvidenceData, LlmCachePromptDivergence} from './types';
import {formatCharacters, formatRate, getPromptDivergenceDescription} from './utils';

interface LlmCachePromptShapeSectionProps {
  evidenceData: LlmCacheEvidenceData;
}

function divergenceStatement(divergence: LlmCachePromptDivergence): ReactNode {
  const {kind, commonPrefixChars, stableSuffixChars, templateMisordered} = divergence;

  if (kind === 'none') {
    return t(
      'The sampled prompts were identical for as far as they could be compared, so the prompt text is not what breaks the cache here. Look at whether caching is switched on for this call at all.'
    );
  }

  if (templateMisordered && stableSuffixChars !== null) {
    return tct(
      'The stable part of this prompt sits behind the part that changes. The prompts start differing [prefix] in, at [kind], and [suffix] of identical content follow. Moving that content in front of the changing part is what makes it cacheable.',
      {
        prefix: <Text bold>{formatCharacters(commonPrefixChars)}</Text>,
        kind: getPromptDivergenceDescription(kind),
        suffix: <Text bold>{formatCharacters(stableSuffixChars)}</Text>,
      }
    );
  }

  return tct(
    'The sampled prompts stop matching [prefix] in, at [kind]. A provider caches a prefix and only a prefix, so nothing past that point can be held between calls.',
    {
      prefix: <Text bold>{formatCharacters(commonPrefixChars)}</Text>,
      kind: getPromptDivergenceDescription(kind),
    }
  );
}

function formatSharedPrefix(divergence: LlmCachePromptDivergence): string {
  const prefix = formatCharacters(divergence.commonPrefixChars);
  if (divergence.prefixShare === null) {
    return prefix;
  }
  return t('%s (%s of the prompt)', prefix, formatRate(divergence.prefixShare));
}

/**
 * Why the cache misses, read off the prompts themselves.
 *
 * Only ever rendered for a call site whose spans carried prompt text, which is
 * opt-in and usually off — so this section is the exception on the page, not
 * part of its skeleton.
 */
export function LlmCachePromptShapeSection({
  evidenceData,
}: LlmCachePromptShapeSectionProps) {
  const divergence = evidenceData.promptDivergence;

  if (divergence === null) {
    return null;
  }

  const {kind, sampleCount, stableSuffixChars} = divergence;

  return (
    <Stack gap="md">
      <Text>{divergenceStatement(divergence)}</Text>
      <Grid columns="fit-content(50%) 1fr" border="primary" radius="md" padding="sm">
        <CallSiteMetric
          id="prompt-shared-prefix"
          label={t('Shared prompt prefix')}
          value={formatSharedPrefix(divergence)}
          emphasized={divergence.templateMisordered}
          tooltip={t(
            'How much of the prompt is identical across the sampled calls before the first difference. Providers cache an exact prefix, so this is the most a cache could hold.'
          )}
        />
        {kind !== 'none' && (
          <CallSiteMetric
            id="prompt-divergence-kind"
            label={t('Prompts first differ at')}
            value={getPromptDivergenceDescription(kind)}
          />
        )}
        {stableSuffixChars !== null && stableSuffixChars > 0 && (
          <CallSiteMetric
            id="prompt-stable-suffix"
            label={t('Identical content after it')}
            value={formatCharacters(stableSuffixChars)}
            tooltip={t(
              'Content that is the same on every sampled call but arrives after the first difference, so no cache can reach it. A lower bound: long prompts are truncated in storage.'
            )}
          />
        )}
      </Grid>
      {sampleCount !== null && (
        <Text size="sm" variant="muted">
          {tn(
            'Measured on %s recent invocation of this call site.',
            'Measured on %s recent invocations of this call site.',
            sampleCount
          )}
        </Text>
      )}
    </Stack>
  );
}
