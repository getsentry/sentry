import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Flex} from 'sentry/components/core/layout';
import {space} from 'sentry/styles/space';

interface ModelNameProps {
  modelId: string;
  provider?: string;
  size?: number;
}

export function ModelName({modelId, provider, size = 16}: ModelNameProps) {
  const platform = getModelPlatform(modelId, provider);

  return (
    <Flex gap={space(1)}>
      <IconWrapper>
        <PlatformIcon platform={platform ?? 'unknown'} size={size} />
      </IconWrapper>
      <NameWrapper>{modelId}</NameWrapper>
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
    {keywords: ['gemma', 'gemini'], platform: 'google'},
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
