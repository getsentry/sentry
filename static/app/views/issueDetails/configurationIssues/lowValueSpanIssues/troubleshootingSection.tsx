import {CodeBlock, InlineCode} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {IconDocs} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/platform';

import type {LowValueSpanEvidenceData} from './types';
import {
  getCustomInstrumentationDocsUrl,
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
      <Stack gap="lg" padding="sm 0">
        <Text variant="muted">
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
      <Stack gap="lg" padding="sm 0">
        <Text variant="muted">
          {tct('Use [ignoreSpans] to drop this exact span:', {
            ignoreSpans: <InlineCode>ignoreSpans</InlineCode>,
          })}
        </Text>
        <CodeBlock language="javascript">
          {getJavaScriptSpanFilterSnippet(evidenceData)}
        </CodeBlock>
      </Stack>
    );
  }

  return (
    <Stack padding="sm 0">
      <Text variant="muted">
        {tct(
          'Add an exact-match span filter for [span]. Match both operation and description so similar useful spans still get sent.',
          {span: <InlineCode>{getSpanLabel(evidenceData)}</InlineCode>}
        )}
      </Text>
    </Stack>
  );
}

function ManualInstrumentationFix({
  evidenceData,
}: {
  evidenceData: LowValueSpanEvidenceData;
}) {
  return (
    <Stack gap="lg">
      <Text variant="muted">
        {t('This appears to come from custom instrumentation in your code.')}
      </Text>
      <Stack gap="xs" padding="sm 0">
        <Heading as="h4">{t('1. Find the custom span')}</Heading>
        <Text variant="muted">
          {tct('Search your codebase for [span].', {
            span: <InlineCode>{getSpanLabel(evidenceData)}</InlineCode>,
          })}
        </Text>
      </Stack>
      <Stack gap="xs" padding="sm 0">
        <Heading as="h4">{t('2. Remove or replace the span')}</Heading>
        <Text variant="muted">
          {t(
            'If this span is not useful for debugging, delete the custom span line or replace it with a more meaningful span.'
          )}
        </Text>
      </Stack>
      <Flex align="center" gap="xs">
        <IconDocs size="xs" />
        <ExternalLink href={getCustomInstrumentationDocsUrl()}>
          {t('Read the custom instrumentation docs')}
        </ExternalLink>
      </Flex>
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
    <Stack gap="lg">
      <Text variant="muted">
        {t(
          'This appears to come from SDK automatic instrumentation. Filter the span matching the operation and description before the span is sent.'
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
    <Stack gap="lg">
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
