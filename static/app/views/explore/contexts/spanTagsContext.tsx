import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';

export function useTraceItemTags(type?: 'number' | 'string', hiddenKeys?: string[]) {
  const {attributes, isLoading, secondaryAliases} = useTraceItemAttributes(
    type,
    hiddenKeys
  );
  return {
    tags: attributes,
    isLoading,
    secondaryAliases,
  };
}
