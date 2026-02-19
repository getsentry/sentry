import {
  useTraceItemAttributes,
  type TraceItemAttributeConfig,
} from 'sentry/views/explore/contexts/traceItemAttributeContext';

export function useTraceItemTags(
  config: TraceItemAttributeConfig,
  type?: 'number' | 'string' | 'boolean',
  hiddenKeys?: string[]
) {
  const {attributes, isLoading, secondaryAliases} = useTraceItemAttributes(
    config,
    type,
    hiddenKeys
  );
  return {
    tags: attributes,
    isLoading,
    secondaryAliases,
  };
}
