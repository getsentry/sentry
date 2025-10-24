import {CodeBlock} from '@sentry/scraps/code';
import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Stack} from 'sentry/components/core/layout';

export function ModuleExports(props: {exports: TypeLoader.TypeLoaderResult['exports']}) {
  if (!props.exports || !props.exports.exports) return null;

  const lines = [];

  if (Object.entries(props.exports.exports).length > 0) {
    const namedList = Object.entries(props.exports.exports)
      .map(([_key, value]) => `${value.typeOnly ? `type ${value.name}` : value.name}`)
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
          language="tsx"
          onCopy={() => addSuccessMessage('Imports copied to clipboard')}
        >
          {lines.join('\n')}
        </CodeBlock>
      </pre>
    </Stack>
  );
}
