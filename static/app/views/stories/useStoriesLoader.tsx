import {ComponentType, useEffect, useState} from 'react';

interface Props {
  filename: string;
}

export default function useStoriesLoader({filename}: Props) {
  const match = filename.match(/app\/components\/(?<filename>.*).stories.tsx/);
  const importName = match?.groups?.filename;

  const [mod, setMod] = useState<Record<string, ComponentType>>({});

  useEffect(() => {
    import(`sentry/components/${importName}.stories`).then(setMod);
  }, [importName]);

  return mod;
}
