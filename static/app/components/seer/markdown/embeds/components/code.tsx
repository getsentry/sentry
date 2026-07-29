import {CodeBlock} from '@sentry/scraps/code';

import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

export const Code = defineSeerEmbed({
  name: 'code',
  render({code, language, filename, highlight}) {
    return (
      <CodeBlock language={language} filename={filename} linesToHighlight={highlight}>
        {code}
      </CodeBlock>
    );
  },
});
