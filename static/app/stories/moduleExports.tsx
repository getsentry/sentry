import {Fragment} from 'react';

import {CodeBlock} from '@sentry/scraps/code';
import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';

export function ModuleExports(props: {
  exports: Record<string, TypeLoader.ComponentDocWithFilename>;
}) {
  return (
    <Fragment>
      <Heading as="h3" size="lg">
        Import
      </Heading>
      <pre>
        <CodeBlock
          language="tsx"
          onCopy={() => addSuccessMessage('Import paths copied to clipboard')}
        >
          {Object.entries(props.exports)
            .map(([_key, value]) => value.importPath)
            .join('\n')}
        </CodeBlock>
      </pre>
    </Fragment>
  );
}
