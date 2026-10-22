import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Flex} from '@sentry/scraps/layout';
import type {SpaceSize} from '@sentry/scraps/theme';

import {t} from 'sentry/locale';

interface ModelNameProps {
  modelId: string | null;
  gap?: SpaceSize;
  /**
   * The provider that served the model, e.g. `gen_ai.provider.name`. Picks the
   * icon when the model ID alone doesn't name its vendor, e.g. `clairic` served
   * by `cloudflare.workers_ai`.
   */
  provider?: string | null;
  size?: number;
}

export function ModelName({modelId, provider, size = 16, gap = 'md'}: ModelNameProps) {
  const platform = getModelPlatform(modelId) ?? getModelPlatform(provider ?? null);

  return (
    <Flex gap={gap}>
      <IconWrapper>
        <PlatformIcon platform={platform ?? 'unknown'} size={size} />
      </IconWrapper>
      <NameWrapper>
        {!modelId || modelId === 'null' ? t('(no value)') : modelId}
      </NameWrapper>
    </Flex>
  );
}

const IconWrapper = styled('div')`
  flex-shrink: 0;
`;

const NameWrapper = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

export function getModelPlatform(modelId: string | null) {
  if (!modelId) {
    return null;
  }

  const lowerCaseModelId = modelId.toLowerCase();

  const providerMap = [
    {keywords: ['text-embedding-00'], platform: 'google'},
    {
      keywords: [
        'openai',
        'gpt',
        'o1',
        'o3',
        'o4',
        'text-embedding-3',
        'text-embedding-ada',
      ],
      platform: 'openai',
    },
    {keywords: ['gemma', 'gemini'], platform: 'gemini'},
    {keywords: ['claude'], platform: 'anthropic-claude'},
    {keywords: ['cohere', 'command-r', 'command-a'], platform: 'cohere'},
    {keywords: ['deepseek'], platform: 'deepseek'},
    {keywords: ['grok'], platform: 'grok'},
    {keywords: ['groq'], platform: 'groq'},
    {keywords: ['huggingface'], platform: 'huggingface'},
    {keywords: ['mistral'], platform: 'mistral'},
    {keywords: ['nemotron', 'nvidia'], platform: 'nvidia'},
    {keywords: ['perplexity'], platform: 'perplexity'},
    {keywords: ['amazon.titan', 'amazon/titan'], platform: 'amazon'},
    {keywords: ['typesafe', 'jev-'], platform: 'typesafe-ai'},
    // Workers AI hosts other vendors' models too (`@cf/mistral/...`), so this
    // goes last and only claims models no vendor above matched.
    {keywords: ['@cf/', 'cloudflare'], platform: 'cloudflare'},
  ];

  const matchedProvider = providerMap.find(({keywords}) =>
    keywords.some(keyword => lowerCaseModelId.includes(keyword))
  );

  if (matchedProvider) {
    return matchedProvider.platform;
  }

  return null;
}
