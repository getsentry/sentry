import {CodeBlock} from '@sentry/scraps/code';

import {useFormattedCode} from 'sentry/utils/useFormattedCode';

export function CodeModeInput({code, language}: {code: string; language: string}) {
  const {formattedCode} = useFormattedCode({
    code,
    language:
      language === 'javascript' || language === 'typescript' ? 'javascript' : null,
  });

  return (
    <CodeBlock
      language={language}
      filename={language}
      alwaysShowCopyButton
      wrapMode="wrap"
    >
      {formattedCode}
    </CodeBlock>
  );
}
