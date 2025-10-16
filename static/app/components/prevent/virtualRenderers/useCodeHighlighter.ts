import {useMemo} from 'react';

import {usePrismTokens} from 'sentry/utils/usePrismTokens';

/**
 * This hook determines the language of the code, and then uses that language to tokenize
 * the code using the `usePrismTokens` hook.
 * @param content - The content of the code.
 * @param fileName - The full name (file.tsx) of the file.
 * @returns The language/file extension of the code and the tokens.
 */
export function useCodeHighlighting(content: string, fileName: string) {
  const language = useMemo(() => {
    if (fileName === '') {
      return 'plaintext';
    }

    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension || extension === '') {
      return 'plaintext';
    }

    return extension;
  }, [fileName]);

  const lines = usePrismTokens({code: content, language});

  return {
    language,
    lines,
  };
}
