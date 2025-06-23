import {Flex} from 'sentry/components/core/layout';
import {IconClaude} from 'sentry/icons/iconClaude';
import {IconGemini} from 'sentry/icons/iconGemini';
import {IconOpenAI} from 'sentry/icons/iconOpenAI';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {space} from 'sentry/styles/space';

interface ModelNameProps {
  modelId: string;
  provider?: string;
}

export function ModelName({modelId, provider}: ModelNameProps) {
  const modelProvider = getModelProvider(modelId, provider);

  const ModelIcon = modelProvider ? providerIconMap[modelProvider] : null;

  return (
    <Flex gap={space(1)}>
      <div>{ModelIcon && <ModelIcon size="md" color="textColor" />}</div>
      <div>{modelId}</div>
    </Flex>
  );
}

const providerIconMap: Record<KnownProvider, React.ComponentType<SVGIconProps>> = {
  openai: IconOpenAI,
  google: IconGemini,
  anthropic: IconClaude,
};

type KnownProvider = 'openai' | 'google' | 'anthropic';

export function getModelProvider(modelId: string, provider?: string) {
  const lowerCaseModelId = modelId.toLowerCase();
  if (provider && provider in providerIconMap) {
    return provider as KnownProvider;
  }
  if (
    lowerCaseModelId.includes('gpt') ||
    lowerCaseModelId.includes('o1') ||
    lowerCaseModelId.includes('o3') ||
    lowerCaseModelId.includes('o4')
  ) {
    return 'openai';
  }
  if (lowerCaseModelId.includes('gemma') || lowerCaseModelId.includes('gemini')) {
    return 'google';
  }
  if (lowerCaseModelId.includes('claude')) {
    return 'anthropic';
  }

  return null;
}
