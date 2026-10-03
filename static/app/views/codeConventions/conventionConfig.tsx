import {Tag} from '@sentry/scraps/badge';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';

import {t} from 'sentry/locale';
import type {TagVariant} from 'sentry/utils/theme';

export interface Convention {
  name: string;
  detect?: string;
  examples?: {bad?: string[]; good?: string[]};
  fix?: string;
  severity?: string;
  tags?: string[];
  why?: string;
}

function getSeverityVariant(severity: string): TagVariant {
  switch (severity) {
    case 'error':
      return 'danger';
    case 'warning':
      return 'warning';
    default:
      return 'muted';
  }
}

function formatExamples(examples: NonNullable<Convention['examples']>) {
  const toCodeBlocks = (snippets: string[]) =>
    snippets.map(snippet => `\`\`\`tsx\n${snippet.trimEnd()}\n\`\`\``).join('\n\n');

  return [
    examples.bad?.length ? `**${t('Bad')}**\n\n${toCodeBlocks(examples.bad)}` : '',
    examples.good?.length ? `**${t('Good')}**\n\n${toCodeBlocks(examples.good)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

interface Props {
  convention: Convention;
}

export function ConventionConfig({convention}: Props) {
  const sections = [
    {key: 'why', title: t('Why'), raw: convention.why},
    {key: 'detect', title: t('Detect'), raw: convention.detect},
    {key: 'fix', title: t('Fix'), raw: convention.fix},
    {
      key: 'examples',
      title: t('Examples'),
      raw: convention.examples ? formatExamples(convention.examples) : undefined,
    },
  ];

  return (
    <Stack gap="xl">
      <Flex gap="sm" wrap="wrap">
        {convention.severity && (
          <Tag variant={getSeverityVariant(convention.severity)}>
            {convention.severity}
          </Tag>
        )}
        {convention.tags?.map(tag => (
          <Tag key={tag} variant="muted">
            {tag}
          </Tag>
        ))}
      </Flex>
      <Stack gap="md">
        {sections.map(({key, title, raw}) =>
          raw ? (
            <Disclosure key={key} defaultExpanded>
              <Disclosure.Title>{title}</Disclosure.Title>
              <Disclosure.Content>
                <Markdown raw={raw} />
              </Disclosure.Content>
            </Disclosure>
          ) : null
        )}
      </Stack>
    </Stack>
  );
}
