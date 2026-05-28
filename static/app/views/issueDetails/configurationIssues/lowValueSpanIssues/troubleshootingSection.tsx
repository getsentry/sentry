import {CodeBlock, InlineCode} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ExternalLink} from 'sentry/components/links/externalLink';
import {IconDocs} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

import {SpanCode} from './spanCode';
import type {LowValueSpanEvidenceData} from './types';
import {
  getJavaScriptSpanFilterSnippet,
  getPythonSpanFilterSnippet,
  getSpanFilteringDocsUrl,
  getSpanLabel,
  isJavaScriptSdk,
  isPythonSdk,
} from './utils';

interface TroubleshootingSectionProps {
  evidenceData: LowValueSpanEvidenceData;
}

function AutomaticInstrumentationFix({
  evidenceData,
}: {
  evidenceData: LowValueSpanEvidenceData;
}) {
  if (isPythonSdk(evidenceData)) {
    return (
      <Stack gap="md">
        <Text>
          {tct(
            'For Python automatic instrumentation, use [hook] to remove matching spans from [spans].',
            {
              hook: <InlineCode>before_send_transaction</InlineCode>,
              spans: <InlineCode>event["spans"]</InlineCode>,
            }
          )}
        </Text>
        <CodeBlock language="python">
          {getPythonSpanFilterSnippet(evidenceData)}
        </CodeBlock>
      </Stack>
    );
  }

  if (isJavaScriptSdk(evidenceData)) {
    return (
      <Stack gap="md">
        <Text>
          {tct(
            'For JavaScript automatic instrumentation, use [ignoreSpans] to drop this exact span before it is sent. Use [beforeSendSpan] only if you need to transform span data instead of dropping it.',
            {
              beforeSendSpan: <InlineCode>beforeSendSpan</InlineCode>,
              ignoreSpans: <InlineCode>ignoreSpans</InlineCode>,
            }
          )}
        </Text>
        <CodeBlock language="javascript">
          {getJavaScriptSpanFilterSnippet(evidenceData)}
        </CodeBlock>
      </Stack>
    );
  }

  return (
    <Text>
      {tct(
        'Check your SDK tracing options and add an exact-match filter for [span]. Filter only this operation and description so useful spans with similar names keep flowing.',
        {span: <SpanCode>{getSpanLabel(evidenceData)}</SpanCode>}
      )}
    </Text>
  );
}

export function TroubleshootingSection({evidenceData}: TroubleshootingSectionProps) {
  return (
    <Stack gap="lg" padding="lg">
      <Heading as="h3">{t('Troubleshooting')}</Heading>
      <Text>
        {t(
          'Start by confirming whether this span is created by custom code or by SDK automatic instrumentation. Then remove it at the source or filter the exact span before it is sent.'
        )}
      </Text>
      <Stack gap="md">
        <Stack gap="xs">
          <Heading as="h4">{t('1. Find where the span is created')}</Heading>
          <Text>
            {tct('Search for code or SDK configuration that creates [span].', {
              span: <SpanCode>{getSpanLabel(evidenceData)}</SpanCode>,
            })}
          </Text>
          {evidenceData.sdkName && (
            <Text>
              {tct('The latest evidence points to the [sdk] SDK.', {
                sdk: <InlineCode>{evidenceData.sdkName}</InlineCode>,
              })}
            </Text>
          )}
        </Stack>
        <Stack gap="xs">
          <Heading as="h4">{t('2. Remove custom instrumentation when possible')}</Heading>
          <Text>
            {t(
              'If this span is manually instrumented and does not describe work you need for debugging, delete the custom span creation line or replace it with a more meaningful span.'
            )}
          </Text>
        </Stack>
        <Stack gap="xs">
          <Heading as="h4">{t('3. Filter automatic instrumentation exactly')}</Heading>
          <AutomaticInstrumentationFix evidenceData={evidenceData} />
        </Stack>
      </Stack>
      <Flex align="center" gap="xs">
        <IconDocs size="xs" />
        <ExternalLink href={getSpanFilteringDocsUrl(evidenceData)}>
          {t('Read the SDK filtering docs')}
        </ExternalLink>
      </Flex>
    </Stack>
  );
}
