import {CodeBlock} from '@sentry/scraps/code';
import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';

export function ModuleExports(props: {exports: TypeLoader.TypeLoaderResult['exports']}) {
  if (!props.exports?.exports) return null;

  const lines = [];

  if (Object.entries(props.exports.exports).length > 0) {
    const entries = Object.entries(props.exports.exports);

    // Optimized merge: types immediately after value exports of the same name, otherwise alphabetized
    const exportsMap = new Map<string, {type?: string; value?: string}>();
    entries.forEach(([key, value]) => {
      if (value.typeOnly) {
        exportsMap.set(key, {...exportsMap.get(key), type: `type ${key}`});
      } else {
        exportsMap.set(key, {...exportsMap.get(key), value: key});
      }
    });
    const namedList = Array.from(exportsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([_key, {value, type}]) =>
        value ? [value, type].filter(Boolean) : [type].filter(Boolean)
      )
      .join(', ');
    lines.push(`import {${namedList}} from '${props.exports.module}';`);
  }

  if (!lines.length) return null;

  return (
    <Stack gap="md" paddingTop="xl">
      <Heading as="h3" size="lg">
        Imports
      </Heading>
      <pre>
        <CodeBlock
          dark
          language="tsx"
          onCopy={() => addSuccessMessage('Imports copied to clipboard')}
        >
          {lines.join('\n')}
        </CodeBlock>
      </pre>
    </Stack>
  );
}
