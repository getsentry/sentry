import {CodeBlock} from '@sentry/scraps/code';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useFormattedCode} from 'sentry/utils/useFormattedCode';

export function CodeModeInput({
  code,
  language,
  summary,
  isSummaryLoading = false,
}: {
  code: string;
  isSummaryLoading?: boolean;
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
      {(summary || isSummaryLoading) && (
        <Stack
          as="section"
          aria-label={t('Summary')}
          aria-busy={isSummaryLoading}
          aria-live="polite"
          gap="md"
        >
          <Heading as="h3" size="md">
            {t('Summary')}
          </Heading>
          {isSummaryLoading ? (
            <Placeholder width="60%" height="20px" />
          ) : (
            <Text as="p" size="md" variant="secondary" density="comfortable">
              {summary}
            </Text>
          )}
        </Stack>
      )}
      <CodeBlock
        filename={language ?? t('code')}
        language={language ?? 'javascript'}
        wrapMode="wrap"
      >
        {formattedCode}
      </CodeBlock>
    </Stack>
  );
}
