import {Fragment} from 'react';
import {IconCopy} from '@sentry/icons/copy';
import {useQuery} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/codeBlock';
import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

import {FIXES, getSymbolicationErrorInfo, GUIDES} from './constants';
import {
  releaseFailuresOptions,
  sampleEventOptions,
  type FailureRow,
  type ReleaseFailures,
} from './queries';

interface FailureDetailsProps {
  organization: Organization;
  project: Project;
  row: FailureRow;
}

function AffectedReleases({organization, project, row}: FailureDetailsProps) {
  const {data, isPending, isError} = useQuery(
    releaseFailuresOptions({organization, project, failure: row})
  );

  if (isPending) {
    return <Placeholder height="80px" />;
  }
  if (isError) {
    return <Text variant="muted">{t('Unable to load the releases.')}</Text>;
  }

  return (
    <Stack gap="xs">
      {data.data.map(item => (
        <Flex key={item.release ?? ''} justify="between" gap="md">
          {item.release ? (
            <Text ellipsis>
              <Link
                to={normalizeUrl(
                  `/organizations/${organization.slug}/releases/${encodeURIComponent(item.release)}/?project=${project.id}`
                )}
              >
                {item.release}
              </Link>
            </Text>
          ) : (
            <Text variant="muted">{t('No release')}</Text>
          )}
          <Text tabular>{formatAbbreviatedNumber(item['count_unique(event_id)'])}</Text>
        </Flex>
      ))}
    </Stack>
  );
}

/**
 * The fix as a task for a coding agent that works in the repository of the
 * project. The text is a prompt, so it stays in English.
 */
function getAgentPrompt({
  organization,
  project,
  row,
  releases,
  eventId,
}: FailureDetailsProps & {
  eventId: string | undefined;
  releases: ReleaseFailures[] | undefined;
}) {
  const info = getSymbolicationErrorInfo(row.error_type);
  const context = {orgSlug: organization.slug, projectSlug: project.slug};
  const steps = GUIDES[info.guide].map((step, index) => {
    const command = step.command
      ? `\n\n   \`\`\`\n   ${step.command(context).replaceAll('\n', '\n   ')}\n   \`\`\``
      : '';
    return `${index + 1}. ${step.text}${command}`;
  });
  const releaseNames = (releases ?? [])
    .filter(item => item.release)
    .map(item => `${item.release} (${item['count_unique(event_id)']} events)`);

  return [
    'Fix a Sentry symbolication failure in this repository.',
    '',
    '## Problem',
    '',
    `Sentry cannot fully symbolicate events of the project \`${project.slug}\` in the organization \`${organization.slug}\`.`,
    '',
    `- Cause: ${info.label} (\`${row.error_type}\`). ${info.description}`,
    `- Issue: ${row.title} (issue ID ${row.group_id})`,
    `- Failed events in the last 30 days: ${row['count_unique(event_id)']}`,
    ...(releaseNames.length ? [`- Affected releases: ${releaseNames.join(', ')}`] : []),
    ...(eventId ? [`- Sample event ID: ${eventId}`] : []),
    '',
    '## Steps',
    '',
    ...steps,
    '',
    '## Rules',
    '',
    '- Make the upload a part of the build or the CI configuration of this repository, so that each new release uploads its files. A manual upload alone is not a fix.',
    '- Read the auth token from the `SENTRY_AUTH_TOKEN` environment variable or CI secret. Do not write a token into a file of the repository.',
    '- If the secret does not exist, stop and ask me to create an organization auth token in Sentry under Settings > Auth Tokens.',
    '- When you finish, list the files you changed and tell me how to verify the next release.',
    '',
    `Docs: ${info.docsUrl}`,
  ].join('\n');
}

/** What failed for one issue and cause, where, and the steps that fix it. */
export function FailureDetails({organization, project, row}: FailureDetailsProps) {
  const info = getSymbolicationErrorInfo(row.error_type);
  const steps = GUIDES[info.guide];
  const fix = info.fix ? FIXES[info.fix] : undefined;
  const sampleEvent = useQuery(sampleEventOptions({organization, project, failure: row}));
  const eventId = sampleEvent.data?.data[0]?.event_id;
  const issueUrl = `/organizations/${organization.slug}/issues/${row.group_id}/`;
  const releases = useQuery(
    releaseFailuresOptions({organization, project, failure: row})
  );
  const {copy} = useCopyToClipboard();

  return (
    <Fragment>
      <DrawerHeader>
        <Heading as="h3" size="lg">
          {info.label}
        </Heading>
      </DrawerHeader>
      <DrawerBody>
        <Stack gap="2xl">
          <Stack gap="md">
            <Text>{info.description}</Text>
            <Text variant="muted">
              {t(
                '%s events of this issue failed for this reason in the last 30 days.',
                formatAbbreviatedNumber(row['count_unique(event_id)'])
              )}
            </Text>
            <Text ellipsis>
              <Link
                to={normalizeUrl(eventId ? `${issueUrl}events/${eventId}/` : issueUrl)}
              >
                {row.title}
              </Link>
            </Text>
          </Stack>

          <Stack gap="md">
            <Heading as="h4">{t('Affected releases')}</Heading>
            <AffectedReleases organization={organization} project={project} row={row} />
          </Stack>

          <Stack gap="md">
            <Heading as="h4">{t('How to fix it')}</Heading>
            {steps.length ? (
              <Stack as="ol" gap="lg" padding="0 0 0 xl" margin="0">
                {steps.map(step => (
                  <li key={step.text}>
                    <Stack gap="sm">
                      <Text>{step.text}</Text>
                      {step.command ? (
                        <CodeBlock language="bash">
                          {step.command({
                            orgSlug: organization.slug,
                            projectSlug: project.slug,
                          })}
                        </CodeBlock>
                      ) : null}
                    </Stack>
                  </li>
                ))}
              </Stack>
            ) : (
              <Text>
                {t(
                  'You cannot fix this with an upload or a setting. The failure does not come from your project configuration.'
                )}
              </Text>
            )}
          </Stack>

          <Flex gap="md" align="center">
            {fix ? (
              <LinkButton
                size="sm"
                variant="primary"
                to={`/settings/${organization.slug}/projects/${project.slug}/${fix.page}`}
              >
                {fix.label}
              </LinkButton>
            ) : null}
            {steps.length ? (
              <Button
                size="sm"
                icon={<IconCopy />}
                onClick={() =>
                  copy(
                    getAgentPrompt({
                      organization,
                      project,
                      row,
                      releases: releases.data?.data,
                      eventId,
                    }),
                    {successMessage: t('Copied prompt to clipboard')}
                  )
                }
              >
                {t('Copy Prompt for AI Agent')}
              </Button>
            ) : null}
            <ExternalLink href={info.docsUrl}>{t('Troubleshooting docs')}</ExternalLink>
          </Flex>
        </Stack>
      </DrawerBody>
    </Fragment>
  );
}
