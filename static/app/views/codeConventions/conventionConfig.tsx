import {Fragment, useState} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {TagVariant} from 'sentry/utils/theme';
import {ConventionEditForm} from 'sentry/views/codeConventions/conventionEditForm';
import type {Convention} from 'sentry/views/codeConventions/utils';

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

function formatFilters({include, exclude, prefilter, detect_command}: Convention) {
  // Globs are wrapped in inline code so their `*`s aren't read as emphasis.
  const toGlobList = (globs: string[]) => globs.map(glob => `- \`${glob}\``).join('\n');

  return [
    include?.length ? `**${t('Include')}**\n\n${toGlobList(include)}` : '',
    exclude?.length ? `**${t('Exclude')}**\n\n${toGlobList(exclude)}` : '',
    prefilter ? `**${t('Prefilter')}**\n\n\`\`\`bash\n${prefilter}\n\`\`\`` : '',
    detect_command
      ? `**${t('Detect Command')}**\n\n\`\`\`bash\n${detect_command}\n\`\`\``
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

interface Props {
  convention: Convention;
  filename: string;
}

export function ConventionConfig({convention, filename}: Props) {
  const [isEditing, setIsEditing] = useState(false);

  const sections = [
    {key: 'why', title: t('Why'), raw: convention.why},
    {key: 'detect', title: t('Detect'), raw: convention.detect},
    {key: 'fix', title: t('Fix'), raw: convention.fix},
    {
      key: 'examples',
      title: t('Examples'),
      raw: convention.examples ? formatExamples(convention.examples) : undefined,
    },
    {key: 'filters', title: t('Filters'), raw: formatFilters(convention)},
  ];

  return (
    <Stack gap="xl">
      <Flex justify="between" align="start" gap="lg">
        <Grid columns="max-content minmax(0, 1fr)" gap="md lg" align="center">
          {convention.severity && (
            <Fragment>
              <Text variant="muted">{t('Severity')}</Text>
              <Flex>
                <Tag variant={getSeverityVariant(convention.severity)}>
                  {convention.severity}
                </Tag>
              </Flex>
            </Fragment>
          )}
          {convention.tags?.length ? (
            <Fragment>
              <Text variant="muted">{t('Tags')}</Text>
              <Flex gap="sm" wrap="wrap">
                {convention.tags.map(tag => (
                  <Tag key={tag} variant="muted">
                    {tag}
                  </Tag>
                ))}
              </Flex>
            </Fragment>
          ) : null}
        </Grid>
        <Button
          size="sm"
          icon={isEditing ? undefined : <IconEdit />}
          onClick={() => setIsEditing(editing => !editing)}
        >
          {isEditing ? t('Cancel') : t('Edit')}
        </Button>
      </Flex>
      {isEditing ? (
        <ConventionEditForm convention={convention} filename={filename} />
      ) : (
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
      )}
    </Stack>
  );
}
