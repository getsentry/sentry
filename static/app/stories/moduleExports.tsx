import {CodeBlock} from '@sentry/scraps/code';
import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Stack} from 'sentry/components/core/layout';

export function ModuleExports(props: {exports: TypeLoader.TypeLoaderResult['exports']}) {
  if (!props.exports) return null;

  const lines: string[] = [];

  for (const module in props.exports) {
    if (!module) continue;

    const line = [];

    const namedList = props.exports[module]
      ?.map(value => `${value.typeOnly ? `type ${value.name}` : value.name}`)
      .join(', ');

    line.push(`import {${namedList}} from '${module}';`);
    lines.push(line.join('\n'));
  }

  if (!lines.length) return null;

  return (
    <Stack gap="md" paddingTop="xl">
      <Heading as="h3" size="lg">
        Imports
      </Heading>
      <pre>
        <CodeBlock
          language="tsx"
          onCopy={() => addSuccessMessage('Imports copied to clipboard')}
        >
          {lines.join('\n')}
        </CodeBlock>
      </pre>
    </Stack>
  );
}
