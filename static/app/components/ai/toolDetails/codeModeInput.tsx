import {CodeBlock} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {t} from 'sentry/locale';
import {useFormattedCode} from 'sentry/utils/useFormattedCode';

export function CodeModeInput({code, language}: {code: string; language: string}) {
  const {formattedCode} = useFormattedCode({
    code,
    language:
      language === 'javascript' || language === 'typescript' ? 'javascript' : null,
  });

  return (
    <Stack gap="sm" minWidth="0">
      <Flex align="center" justify="between" gap="sm">
        <Text size="sm" variant="muted">
          {language}
        </Text>
        <CopyToClipboardButton
          text={formattedCode}
          aria-label={t('Copy snippet')}
          size="xs"
          variant="transparent"
        />
      </Flex>
      <CodeBlock language={language} hideCopyButton wrapMode="wrap">
        {formattedCode}
      </CodeBlock>
    </Stack>
  );
}
