import {CodeBlock} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {t} from 'sentry/locale';
import {useFormattedCode} from 'sentry/utils/useFormattedCode';

const PYTHON_PATTERNS = [
  /^\s*(def|class)\s+\w+[^{]*:\s*$/m,
  /^\s*(if|elif|else|for|while|try|except|finally|with)\b[^{;]*:\s*$/m,
  /^\s*from\s+[\w.]+\s+import\s/m,
  /^\s*import\s+[\w.]+(\s*,\s*[\w.]+)*\s*$/m,
  /^\s*print\(/m,
];

/**
 * Most Code Mode tools run JavaScript and omit the language, so unlabeled code
 * is highlighted as JavaScript unless it clearly reads as Python. The guess
 * only drives highlighting; formatting stays limited to explicit JS/TS because
 * a wrong guess there would rewrite the code.
 */
function guessHighlightLanguage(code: string) {
  return PYTHON_PATTERNS.some(pattern => pattern.test(code)) ? 'python' : 'javascript';
}

export function CodeModeInput({code, language}: {code: string; language?: string}) {
  const {formattedCode} = useFormattedCode({
    code,
    language:
      language === 'javascript' || language === 'typescript' ? 'javascript' : null,
  });

  return (
    <Stack gap="sm" minWidth="0">
      <Flex align="center" justify="between" gap="sm">
        <Text size="sm" variant="muted">
          {language ?? t('code')}
        </Text>
        <CopyToClipboardButton
          text={formattedCode}
          aria-label={t('Copy snippet')}
          size="xs"
          variant="transparent"
        />
      </Flex>
      <CodeBlock
        language={language ?? guessHighlightLanguage(code)}
        hideCopyButton
        wrapMode="wrap"
      >
        {formattedCode}
      </CodeBlock>
    </Stack>
  );
}
