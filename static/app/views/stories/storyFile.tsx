import {ComponentProps, ComponentType, useEffect, useState} from 'react';

interface Props extends ComponentProps<'div'> {
  filename: string;
}

export default function Story({filename, style}: Props) {
  const match = filename.match(/app\/components\/(?<filename>.*).stories.tsx/);
  const importName = match?.groups?.filename;

  const [mod, setMod] = useState<Record<string, ComponentType>>({});

  useEffect(() => {
    import(`sentry/components/${importName}.stories`).then(setMod);
  }, [importName]);

  return (
    <div key={filename} style={style}>
      <h2>{filename}</h2>

      <div>
        {Object.entries(mod).map(([field, Component]) => (
          <Component key={field} />
        ))}
      </div>
    </div>
  );
}
