import {CodeBlock} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {t} from 'sentry/locale';
import {useFormattedCode} from 'sentry/utils/useFormattedCode';

export function CodeModeInput({
  code,
  language,
  summary,
}: {
  code: string;
  language?: string;
  summary?: string;
}) {
  const {formattedCode} = useFormattedCode({
    code,
    language:
      language === 'javascript' || language === 'typescript' ? 'javascript' : null,
  });

  return (
    <Stack gap="lg" minWidth="0">
      {summary && (
        <Stack as="section" aria-label={t('Summary')} gap="md">
          <Heading as="h3" size="md">
            {t('Summary')}
          </Heading>
          <Text as="p" size="md" variant="secondary" density="comfortable">
            {summary}
          </Text>
        </Stack>
      )}
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
        <CodeBlock language={language ?? 'javascript'} hideCopyButton wrapMode="wrap">
          {formattedCode}
        </CodeBlock>
      </Stack>
    </Stack>
  );
}
