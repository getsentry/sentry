import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {IconDocs} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {LlmCacheEvidenceData} from './types';
import {
  getCacheProvider,
  getPromptCachingDocsLabel,
  getPromptCachingDocsUrl,
} from './utils';

interface LlmCacheTroubleshootingSectionProps {
  evidenceData: LlmCacheEvidenceData;
}

interface Step {
  body: string;
  title: string;
}

function getEnableCachingBody(model: string | null): string {
  switch (getCacheProvider(model)) {
    case 'anthropic':
      return t(
        'Add a cache_control breakpoint to the last stable block of the request — the system prompt or the tool definitions. Without one, nothing is cached.'
      );
    case 'openai':
      return t(
        'Caching is automatic for prompts over 1024 tokens. A near-zero hit rate means the first 1024 tokens differ on every call.'
      );
    case 'google':
      return t(
        'Newer Gemini models cache implicitly; for the others, create an explicit cached-content object for the shared prefix.'
      );
    default:
      return t(
        "Check whether this provider caches automatically or needs an explicit cache breakpoint, and that the SDK path you're using sets one."
      );
  }
}

function getSteps(evidenceData: LlmCacheEvidenceData): Step[] {
  if (evidenceData.outcome === 'thrash') {
    return [
      {
        title: t('Find what changes at the top of the prompt'),
        body: t(
          'Compare two of the example calls above. Look for timestamps, session ids, retrieved documents, or tools serialized in a different order — any difference invalidates the cached prefix behind it.'
        ),
      },
      {
        title: t('Move changing content below the cache breakpoint'),
        body: t(
          'Everything before the breakpoint has to be byte-identical across calls. Move dynamic content after it, or into the user turn.'
        ),
      },
      {
        title: t('Stop caching per-session content'),
        body: t(
          'A prefix unique to one user or session pays the cache-write premium on every call and is rarely read back. Cache only what is shared across calls.'
        ),
      },
      {
        title: t('Verify the fix'),
        body: t(
          'Watch the cache activity chart above: the write:read ratio should fall below 1 once the prefix is stable.'
        ),
      },
    ];
  }

  return [
    {
      title: t('Check that caching is enabled'),
      body: getEnableCachingBody(evidenceData.model),
    },
    {
      title: t('Put stable content first'),
      body: t(
        'Order the request so the parts that never change — system prompt, tool definitions, reference documents — come before per-call content. Caches match on an exact prefix.'
      ),
    },
    {
      title: t('Keep the prefix byte-identical'),
      body: t(
        'Remove timestamps, request ids and user-specific values from the shared prefix, and serialize tool definitions in a fixed order.'
      ),
    },
    {
      title: t('Verify the fix'),
      body: t(
        'Watch the cache activity chart above: the hit rate should climb within a few hours of deploying.'
      ),
    },
  ];
}

export function LlmCacheTroubleshootingSection({
  evidenceData,
}: LlmCacheTroubleshootingSectionProps) {
  const steps = getSteps(evidenceData);

  return (
    <Stack gap="lg">
      {steps.map((step, index) => (
        <Stack key={step.title} gap="xs" padding="sm 0">
          <Heading as="h4">{t('%s. %s', index + 1, step.title)}</Heading>
          <Text variant="muted">{step.body}</Text>
        </Stack>
      ))}
      <Flex align="center" gap="xs">
        <IconDocs size="xs" />
        <ExternalLink href={getPromptCachingDocsUrl(evidenceData.model)}>
          {getPromptCachingDocsLabel(evidenceData.model)}
        </ExternalLink>
      </Flex>
    </Stack>
  );
}
