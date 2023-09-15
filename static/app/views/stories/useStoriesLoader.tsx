import {useEffect, useState} from 'react';

import type {ResolvedStoryModule} from 'sentry/views/stories/types';

interface Props {
  filename: string;
}

interface EmptyState {
  error: undefined;
  filename: undefined | string;
  importName: undefined | string;
  resolved: undefined;
}

interface ResolvedState {
  error: undefined;
  filename: string;
  importName: string;
  resolved: ResolvedStoryModule;
}

interface ErrorState {
  error: Error;
  filename: undefined | string;
  importName: undefined | string;
  resolved: undefined;
}

type State = EmptyState | ResolvedState | ErrorState;

export default function useStoriesLoader({filename}: Props) {
  const match = filename?.match(/app\/(?<filename>.*).stories.tsx/);
  const importName = match?.groups?.filename;

  const [mod, setMod] = useState<State>({
    error: undefined,
    filename,
    importName,
    resolved: undefined,
  });

  useEffect(() => {
    if (!filename) {
      return;
    }
    if (importName) {
      import(`sentry/${importName}.stories`)
        .then(resolved => {
          setMod({
            error: undefined,
            filename,
            importName,
            resolved,
          });
        })
        .catch(error => {
          setMod({
            error,
            filename,
            importName,
            resolved: undefined,
          });
        });
    } else {
      setMod({
        error: new Error(`Invalid importName for filename '${filename}'`),
        filename,
        importName,
        resolved: undefined,
      });
    }
  }, [filename, importName]);

  return mod;
}
