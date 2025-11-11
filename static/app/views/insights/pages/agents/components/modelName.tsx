import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Flex} from 'sentry/components/core/layout';
import {t} from 'sentry/locale';
import type {Space} from 'sentry/utils/theme/theme';

interface ModelNameProps {
  modelId: string;
  gap?: Space;
  provider?: string;
  size?: number;
}

export function ModelName({modelId, provider, size = 16, gap = 'md'}: ModelNameProps) {
  const platform = getModelPlatform(modelId, provider);

  return (
    <Flex gap={gap}>
      <IconWrapper>
        <PlatformIcon platform={platform ?? 'unknown'} size={size} />
      </IconWrapper>
      <NameWrapper>{modelId === 'null' ? t('(no value)') : modelId}</NameWrapper>
    </Flex>
  );
}

const IconWrapper = styled('div')`
  flex-shrink: 0;
`;

const NameWrapper = styled('div')`
  ${p => p.theme.overflowEllipsis}
  min-width: 0;
`;

export function getModelPlatform(modelId: string, provider?: string) {
  if (provider) {
    return provider;
  }

  const lowerCaseModelId = modelId.toLowerCase();

  const providerMap = [
    {keywords: ['gpt', 'o1', 'o3', 'o4'], platform: 'openai'},
    {keywords: ['gemma', 'gemini'], platform: 'gemini'},
    {keywords: ['claude'], platform: 'anthropic-claude'},
    {keywords: ['deepseek'], platform: 'deepseek'},
    {keywords: ['grok'], platform: 'grok'},
    {keywords: ['groq'], platform: 'groq'},
    {keywords: ['mistral'], platform: 'mistral'},
    {keywords: ['perplexity'], platform: 'perplexity'},
  ];

  const matchedProvider = providerMap.find(({keywords}) =>
    keywords.some(keyword => lowerCaseModelId.includes(keyword))
  );

  if (matchedProvider) {
    return matchedProvider.platform;
  }

  return null;
}
