import {Fragment} from 'react';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {LlmCacheActivityChart} from './llmCacheActivityChart';
import {LlmCacheComparisonSection} from './llmCacheComparisonSection';
import {LlmCacheExampleCalls} from './llmCacheExampleCalls';
import {LlmCacheProblemSection} from './llmCacheProblemSection';
import {LlmCachePromptShapeSection} from './llmCachePromptShapeSection';
import {LlmCacheTroubleshootingSection} from './llmCacheTroubleshootingSection';
import {getLlmCacheEvidenceData} from './utils';

interface LlmCacheUsageSectionsProps {
  event: Event;
}

/**
 * The body of an LLM Cache Usage issue.
 *
 * Both findings share this layout: they are alternative readings of one call
 * site and the same issue can present as either between runs, so only the copy
 * and the emphasis change, never the structure.
 */
export function LlmCacheUsageSections({event}: LlmCacheUsageSectionsProps) {
  const evidenceData = getLlmCacheEvidenceData(event.occurrence?.evidenceData);

  return (
    <Fragment>
      <FoldSection sectionKey={SectionKey.LLM_CACHE_PROBLEM} title={t('Problem')}>
        <LlmCacheProblemSection evidenceData={evidenceData} />
      </FoldSection>
      {evidenceData.promptDivergence !== null && (
        <FoldSection
          sectionKey={SectionKey.LLM_CACHE_PROMPT_SHAPE}
          title={t('Prompt Shape')}
        >
          <LlmCachePromptShapeSection evidenceData={evidenceData} />
        </FoldSection>
      )}
      {evidenceData.anchor !== null && (
        <FoldSection
          sectionKey={SectionKey.LLM_CACHE_COMPARISON}
          title={t('Healthy Comparison')}
        >
          <LlmCacheComparisonSection evidenceData={evidenceData} />
        </FoldSection>
      )}
      <ErrorBoundary mini>
        <FoldSection
          sectionKey={SectionKey.LLM_CACHE_ACTIVITY}
          title={t('Cache Activity')}
        >
          <LlmCacheActivityChart evidenceData={evidenceData} />
        </FoldSection>
      </ErrorBoundary>
      {evidenceData.sampleCalls.length > 0 && (
        <FoldSection
          sectionKey={SectionKey.LLM_CACHE_EXAMPLE_CALLS}
          title={t('Example Calls')}
        >
          <LlmCacheExampleCalls evidenceData={evidenceData} />
        </FoldSection>
      )}
      <FoldSection
        sectionKey={SectionKey.LLM_CACHE_TROUBLESHOOTING}
        title={t('Troubleshooting')}
      >
        <LlmCacheTroubleshootingSection evidenceData={evidenceData} />
      </FoldSection>
    </Fragment>
  );
}
