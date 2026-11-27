import {Fragment} from 'react';
import {IconCopy} from '@sentry/icons/copy';
import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/codeBlock';
import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {openReprocessEventModal} from 'sentry/actionCreators/modal';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

import {FIXES, getSymbolicationErrorInfo, GUIDES} from './constants';
import {
  failedFilesOptions,
  releaseFailuresOptions,
  sampleEventOptions,
  uploadedDebugFilesOptions,
  type FailureFilters,
  type FailureRow,
  type ReleaseFailures,
} from './queries';

interface FailureDetailsProps {
  filters: FailureFilters;
  organization: Organization;
  project: Project;
  row: FailureRow;
}

function AffectedReleases({organization, project, filters, row}: FailureDetailsProps) {
  const {data, isPending, isError} = useQuery(
    releaseFailuresOptions({organization, project, filters, failure: row})
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

function UploadedTag({
  organization,
  project,
  debugId,
}: Pick<FailureDetailsProps, 'organization' | 'project'> & {debugId: string}) {
  const {data} = useQuery(uploadedDebugFilesOptions({organization, project, debugId}));

  if (!data?.length) {
    return null;
  }

  return (
    <Tooltip
      title={t(
        'Sentry has this file now. Events from before the upload stay unsymbolicated until you reprocess them.'
      )}
    >
      <Tag variant="success">{t('Uploaded')}</Tag>
    </Tooltip>
  );
}

// Events from before Sentry stored the failed file have no file, so the list
// can be empty. The section then does not show.
function FailedFiles({organization, project, filters, row}: FailureDetailsProps) {
  const {data} = useQuery(
    failedFilesOptions({organization, project, filters, failure: row})
  );
  const files = (data?.data ?? []).filter(file => file.file_name || file.debug_id);

  if (!files.length) {
    return null;
  }

  return (
    <Stack gap="md">
      <Heading as="h4">{t('Files that failed')}</Heading>
      <Stack gap="sm">
        {files.map(file => (
          <Flex key={`${file.file_name},${file.debug_id}`} justify="between" gap="md">
            <Stack gap="2xs" minWidth="0">
              {file.file_name ? <Text ellipsis>{file.file_name}</Text> : null}
              {file.debug_id ? (
                <Text size="xs" variant="muted" monospace ellipsis>
                  {file.debug_id}
                </Text>
              ) : null}
            </Stack>
            <Flex gap="md" align="center">
              {file.debug_id ? (
                <UploadedTag
                  organization={organization}
                  project={project}
                  debugId={file.debug_id}
                />
              ) : null}
              <Text tabular>
                {formatAbbreviatedNumber(file['count_unique(event_id)'])}
              </Text>
            </Flex>
          </Flex>
        ))}
      </Stack>
    </Stack>
  );
}

function getAgentPrompt({
  organization,
  project,
  row,
  releases,
  eventId,
}: Omit<FailureDetailsProps, 'filters'> & {
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
    '- If the secret does not exist, use the Sentry CLI or the Sentry MCP server to create an organization auth token.',
    '- Before you create or use the token, tell me what the token does and why the upload needs it.',
    '- When you finish, list the files you changed and tell me how to verify the next release.',
    '',
    `Docs: ${info.docsUrl}`,
  ].join('\n');
}

export function FailureDetails({
  organization,
  project,
  filters,
  row,
}: FailureDetailsProps) {
  const info = getSymbolicationErrorInfo(row.error_type);
  const steps = GUIDES[info.guide];
  const fix = info.fix ? FIXES[info.fix] : undefined;
  const sampleEvent = useQuery(
    sampleEventOptions({organization, project, filters, failure: row})
  );
  const eventId = sampleEvent.data?.data[0]?.event_id;
  const issueUrl = `/organizations/${organization.slug}/issues/${row.group_id}/`;
  const releases = useQuery(
    releaseFailuresOptions({organization, project, filters, failure: row})
  );
  // An agent in the repository can only help when a step has a command to run.
  const hasAgentPrompt = steps.some(step => step.command);
  // Sentry can process the events of an issue again only when they use debug files.
  const canReprocess = info.category === 'native';
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
            <AffectedReleases
              organization={organization}
              project={project}
              filters={filters}
              row={row}
            />
          </Stack>

          <FailedFiles
            organization={organization}
            project={project}
            filters={filters}
            row={row}
          />

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

          <Flex gap="md" align="center" wrap="wrap">
            {fix ? (
              <LinkButton
                size="sm"
                variant="primary"
                to={`/settings/${organization.slug}/projects/${project.slug}/${fix.page}`}
              >
                {fix.label}
              </LinkButton>
            ) : null}
            {canReprocess ? (
              <Button
                size="sm"
                tooltipProps={{
                  title: t(
                    'After the debug files are in Sentry, process the events of this issue again.'
                  ),
                }}
                onClick={() =>
                  openReprocessEventModal({organization, groupId: String(row.group_id)})
                }
              >
                {t('Reprocess Events')}
              </Button>
            ) : null}
            {hasAgentPrompt ? (
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
