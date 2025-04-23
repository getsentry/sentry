import type {UseQueryOptions} from '@tanstack/react-query';
import {skipToken, useQuery} from '@tanstack/react-query';

import {asyncSanitizedMarked, sanitizedMarked, singleLineRenderer} from './marked';

type UseMarkedQueryOptions = Omit<UseQueryOptions<string>, 'queryKey' | 'queryFn'>;

interface UseMarkedOptions {
  /**
   * The raw markdown text
   */
  text: string;
  inline?: boolean;
  options?: UseMarkedQueryOptions;
}

/**
 * Helps handle the async processing of markdown text.
 * Displays a placholder while syntax highlighting is loading.
 */
export function useMarked({text, inline, options}: UseMarkedOptions) {
  return useQuery<string>({
    queryKey: ['markdown', text, inline],
    queryFn: text ? () => asyncSanitizedMarked(text, inline) : skipToken,
    staleTime: Infinity,
    // Use the non-highlighted version as placeholder data
    placeholderData: () => (inline ? singleLineRenderer(text) : sanitizedMarked(text)),
    ...options,
  });
}
