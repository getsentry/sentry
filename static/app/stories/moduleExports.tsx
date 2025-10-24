import {Fragment} from 'react';

import {CodeBlock} from '@sentry/scraps/code';
import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';

export function ModuleExports(props: {
  exports: Record<string, TypeLoader.ComponentDocWithFilename>;
}) {
  const entries = Object.entries(props.exports);
  if (entries.length === 0) return '';
  // Assume all exports are from a single module, just take the first one's value.module
  const modulePath = entries[0]?.[1]?.module;
  const defaultExport = entries.find(([_key, value]) => value?.displayName === 'default');
  const namedExports = entries.filter(
    ([_key, value]) => value?.displayName !== 'default'
  );

  const lines = [];
  if (defaultExport) {
    const [key] = defaultExport;
    lines.push(`import ${key} from '${modulePath}';`);
  }
  if (namedExports.length > 0) {
    const namedList = namedExports.map(([_, value]) => value.displayName).join(', ');
    lines.push(`import {${namedList}} from '${modulePath}';`);
  }

  return (
    <Fragment>
      <Heading as="h3" size="lg">
        Import
      </Heading>
      <pre>
        <CodeBlock
          language="tsx"
          onCopy={() => addSuccessMessage('Imports copied to clipboard')}
        >
          {lines.join('\n')}
        </CodeBlock>
      </pre>
    </Fragment>
  );
}
