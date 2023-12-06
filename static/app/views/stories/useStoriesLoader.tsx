import {useCallback, useEffect, useState} from 'react';

import storiesContext from 'sentry/views/stories/storiesContext';
import type {ResolvedStoryModule} from 'sentry/views/stories/types';

interface Props {
  filename: string;
}

interface EmptyState {
  error: undefined;
  filename: undefined | string;
  resolved: undefined;
}

interface ResolvedState {
  error: undefined;
  filename: string;
  resolved: ResolvedStoryModule;
}

interface ErrorState {
  error: Error;
  filename: undefined | string;
  resolved: undefined;
}

type State = EmptyState | ResolvedState | ErrorState;

export default function useStoriesLoader({filename}: Props) {
  const [mod, setMod] = useState<State>({
    error: undefined,
    filename,
    resolved: undefined,
  });

  const asyncImportStory = useCallback(async () => {
    if (!filename) {
      return;
    }
    try {
      setMod({
        error: undefined,
        filename,
        resolved: undefined,
      });
      const resolved = await storiesContext().importStory(filename);
      setMod({
        error: undefined,
        filename,

        resolved,
      });
    } catch (error) {
      setMod({
        error,
        filename,

        resolved: undefined,
      });
    }
  }, [filename]);

  useEffect(() => {
    asyncImportStory();
  }, [asyncImportStory]);

  return mod;
}
