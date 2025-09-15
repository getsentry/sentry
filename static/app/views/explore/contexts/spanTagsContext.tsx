import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';

export function useTraceItemTags(type?: 'number' | 'string') {
  const {attributes, isLoading, secondaryAliases} = useTraceItemAttributes(type);
  return {
    tags: attributes,
    isLoading,
    secondaryAliases,
  };
}
