import {Fragment} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

export interface IssueSummary {
  headline: string;
  possibleCause: string | null;
  trace: string | null;
  whatsWrong: string | null;
}

interface Props {
  summary: IssueSummary;
}

export function getIssueSummaryText(summary?: IssueSummary) {
  if (!summary) {
    return {description: '', trace: ''};
  }

  const description = [
    summary.whatsWrong?.trim() || summary.headline.trim(),
    summary.possibleCause?.trim(),
  ]
    .filter(Boolean)
    .join(' ');
  return {description, trace: summary.trace?.trim() ?? ''};
}

function SummaryMarkdown({raw}: {raw: string}) {
  return (
    <Markdown
      raw={raw}
      components={{
        Strong: ({children}) => <Fragment>{children}</Fragment>,
        Paragraph: ({children}) => (
          <Text as="p" size="md" variant="secondary" density="comfortable">
            {children}
          </Text>
        ),
      }}
    />
  );
}

export function IssuePreviewSummary({summary}: Props) {
  const {description, trace} = getIssueSummaryText(summary);

  if (!description && !trace) {
    return null;
  }

  return (
    <Stack as="section" aria-label={t('Summary')} gap="xl">
      {description && (
        <Stack gap="md">
          <Heading as="h3" size="md">
            {t('Summary')}
          </Heading>
          <SummaryMarkdown raw={description} />
        </Stack>
      )}
      {trace && (
        <Stack gap="md">
          <Heading as="h4" size="md">
            {t('In the trace')}
          </Heading>
          <SummaryMarkdown raw={trace} />
        </Stack>
      )}
    </Stack>
  );
}
