import {CodeBlock, InlineCode} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ExternalLink} from 'sentry/components/links/externalLink';
import {IconDocs} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/platform';

import {SpanCode} from './spanCode';
import type {LowValueSpanEvidenceData} from './types';
import {
  getJavaScriptSpanFilterSnippet,
  getPythonSpanFilterSnippet,
  getSpanFilteringDocsUrl,
  getSpanLabel,
  isJavaScriptProjectPlatform,
  isPythonProjectPlatform,
} from './utils';

interface TroubleshootingSectionProps {
  evidenceData: LowValueSpanEvidenceData;
  projectPlatform?: PlatformKey | null;
}

function AutomaticInstrumentationFix({
  evidenceData,
  projectPlatform,
}: {
  evidenceData: LowValueSpanEvidenceData;
  projectPlatform?: PlatformKey | null;
}) {
  if (isPythonProjectPlatform(projectPlatform)) {
    return (
      <Stack gap="md">
        <Text>
          {tct('Use [hook] to remove matching spans from [spans].', {
            hook: <InlineCode>before_send_transaction</InlineCode>,
            spans: <InlineCode>event["spans"]</InlineCode>,
          })}
        </Text>
        <CodeBlock language="python">
          {getPythonSpanFilterSnippet(evidenceData)}
        </CodeBlock>
      </Stack>
    );
  }

  if (isJavaScriptProjectPlatform(projectPlatform)) {
    return (
      <Stack gap="md">
        <Text>
          {tct(
            'Use [ignoreSpans] to drop this exact span. Use [beforeSendSpan] only when you need to change span data.',
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
        'Add an exact-match span filter for [span]. Match both operation and description so similar useful spans still get sent.',
        {span: <SpanCode>{getSpanLabel(evidenceData)}</SpanCode>}
      )}
    </Text>
  );
}

function ManualInstrumentationFix({
  evidenceData,
}: {
  evidenceData: LowValueSpanEvidenceData;
}) {
  return (
    <Stack gap="md">
      <Text>{t('This appears to come from custom instrumentation in your code.')}</Text>
      <Stack gap="xs">
        <Heading as="h4">{t('1. Find the custom span')}</Heading>
        <Text>
          {tct('Search your codebase for [span].', {
            span: <SpanCode>{getSpanLabel(evidenceData)}</SpanCode>,
          })}
        </Text>
      </Stack>
      <Stack gap="xs">
        <Heading as="h4">{t('2. Remove or replace the span')}</Heading>
        <Text>
          {t(
            'If this span is not useful for debugging, delete the custom span line or replace it with a more meaningful span.'
          )}
        </Text>
      </Stack>
    </Stack>
  );
}

function AutomaticInstrumentationTroubleshooting({
  evidenceData,
  projectPlatform,
}: {
  evidenceData: LowValueSpanEvidenceData;
  projectPlatform?: PlatformKey | null;
}) {
  return (
    <Stack gap="md">
      <Text>
        {t(
          'This appears to come from SDK automatic instrumentation. Filter the exact operation and description before the span is sent.'
        )}
      </Text>
      <AutomaticInstrumentationFix
        evidenceData={evidenceData}
        projectPlatform={projectPlatform}
      />
      <Flex align="center" gap="xs">
        <IconDocs size="xs" />
        <ExternalLink href={getSpanFilteringDocsUrl(projectPlatform)}>
          {t('Read the SDK filtering docs')}
        </ExternalLink>
      </Flex>
    </Stack>
  );
}

export function TroubleshootingSection({
  evidenceData,
  projectPlatform,
}: TroubleshootingSectionProps) {
  const isManualInstrumentation = evidenceData.spanOrigin === 'manual';

  return (
    <Stack gap="lg" padding="lg">
      <Heading as="h3">{t('Troubleshooting')}</Heading>
      {isManualInstrumentation ? (
        <ManualInstrumentationFix evidenceData={evidenceData} />
      ) : (
        <AutomaticInstrumentationTroubleshooting
          evidenceData={evidenceData}
          projectPlatform={projectPlatform}
        />
      )}
    </Stack>
  );
}
