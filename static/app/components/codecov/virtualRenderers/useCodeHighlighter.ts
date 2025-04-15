import {useMemo} from 'react';

import {usePrismTokens} from 'sentry/utils/usePrismTokens';

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
