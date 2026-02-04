import {CodeBlock} from '@sentry/scraps/code';
import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';

export function ModuleExports(props: {exports: TypeLoader.TypeLoaderResult['exports']}) {
  if (!props.exports?.exports) return null;

  const lines = [];
  // canonical source: @sentry/scraps/<component> (no deep imports)
  const importSpecifier = props.exports.module.startsWith('@sentry/scraps/')
    ? props.exports.module.split('/').slice(0, 3).join('/')
    : props.exports.module;

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

    const sortedEntries = Array.from(exportsMap.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const namedList: string[] = [];

    for (let i = 0; i < sortedEntries.length; i++) {
      const [key, {value, type}] = sortedEntries[i]!;

      if (value) {
        // If this entry has both value and type, combine them
        if (type) {
          namedList.push(`${value}, ${type}`);
        } else {
          // Check if the next entry is a type-only export that starts with this value's key
          const nextEntry = sortedEntries[i + 1];
          if (nextEntry) {
            const [nextKey, nextExport] = nextEntry;
            if (!nextExport.value && nextExport.type && nextKey.startsWith(key)) {
              // Combine on same line
              namedList.push(`${value}, ${nextExport.type}`);
              i++; // Skip the next entry since we've combined it
              continue;
            }
          }
          namedList.push(value);
        }
      } else if (type) {
        // Type-only export that wasn't combined with a previous value
        namedList.push(type);
      }
    }

    if (namedList.join(', ').length > 80) {
      lines.push(`import {\n ${namedList.join(',\n ')}\n} from '${importSpecifier}';`);
    } else {
      lines.push(`import {${namedList.join(', ')}} from '${importSpecifier}';`);
    }
  }

  if (!lines.length) return null;

  return (
    <Stack gap="md" paddingTop="xl">
      <Heading as="h3" size="lg">
        Imports
      </Heading>
      <CodeBlock
        dark
        language="tsx"
        onCopy={() => addSuccessMessage('Imports copied to clipboard')}
      >
        {lines.join('\n')}
      </CodeBlock>
    </Stack>
  );
}
