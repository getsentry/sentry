import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {IconCode} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PullRequestFileChangeType} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {TagVariant} from 'sentry/utils/theme';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

import {parseFilePatch} from './filePatch';
import {
  type OverviewPullRequest,
  type OverviewPullRequestFile,
  type PullRequestFileDiff,
  type PullRequestFilesResponse,
  QUERY_STALE_TIME,
} from './types';

const FILE_CHANGE_TAG: Record<
  PullRequestFileChangeType,
  {label: string; variant: TagVariant}
> = {
  ADDED: {label: t('Added'), variant: 'success'},
  CHANGED: {label: t('Changed'), variant: 'muted'},
  COPIED: {label: t('Copied'), variant: 'muted'},
  DELETED: {label: t('Deleted'), variant: 'danger'},
  MODIFIED: {label: t('Modified'), variant: 'muted'},
  RENAMED: {label: t('Renamed'), variant: 'muted'},
};

function FileDiff({
  file,
  diff,
  isPending,
  isError,
}: {
  diff: PullRequestFileDiff | undefined;
  file: OverviewPullRequestFile;
  isError: boolean;
  isPending: boolean;
}) {
  const patch = useMemo(
    () =>
      diff && (diff.patch || file.changeType === 'DELETED')
        ? parseFilePatch({
            path: file.path,
            patch: diff.patch,
            additions: file.additions,
            deletions: file.deletions,
            changeType: file.changeType,
          })
        : null,
    [diff, file.path, file.additions, file.deletions, file.changeType]
  );

  if (isPending && !diff) {
    return <Placeholder height="4rem" />;
  }
  if (isError) {
    return (
      <Text size="sm" variant="danger">
        {t('Failed to load diff.')}
      </Text>
    );
  }
  if (patch) {
    return <FileDiffViewer hideHeader patch={patch} />;
  }
  return (
    <Text size="sm" variant="muted">
      {t('No diff available.')}
    </Text>
  );
}

// Each row expands to its diff. Expanding the first file fetches every file's
// patch for the PR in one request, so opening the rest is instant from cache.
export function PullRequestFiles({
  orgSlug,
  pullRequest,
}: {
  orgSlug: string;
  pullRequest: OverviewPullRequest;
}) {
  const files = pullRequest.files;
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set());

  const {data, isPending, isError} = useQuery({
    ...apiOptions.as<PullRequestFilesResponse>()(
      '/organizations/$organizationIdOrSlug/pull-requests/$pullRequestId/files/',
      {
        path: {organizationIdOrSlug: orgSlug, pullRequestId: pullRequest.id},
        staleTime: QUERY_STALE_TIME,
      }
    ),
    enabled: expandedRows.size > 0,
  });

  const diffByPath = useMemo(
    () => new Map((data?.files ?? []).map(file => [file.path, file])),
    [data]
  );

  const toggle = (index: number, expanded: boolean) =>
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (expanded) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });

  return (
    <Stack gap="sm">
      <Flex gap="xs" align="center">
        <IconCode size="xs" variant="secondary" aria-hidden />
        <Text size="xs" bold uppercase variant="secondary">
          {t('Code changes')}
        </Text>
      </Flex>
      <Text size="sm" variant="muted">
        {files.length === 1
          ? t('1 file changed')
          : t('%s files changed', files.length.toLocaleString())}
      </Text>
      <Container border="primary" radius="md" overflow="hidden" background="secondary">
        {files.map((file, index) => {
          const changeTag = file.changeType ? FILE_CHANGE_TAG[file.changeType] : null;
          const diff = diffByPath.get(file.path);
          const isExpanded = expandedRows.has(index);
          return (
            <FileRow key={`${index}-${file.path}`}>
              <Disclosure
                size="sm"
                expanded={isExpanded}
                onExpandedChange={next => toggle(index, next)}
              >
                <Disclosure.Title
                  trailingItems={
                    changeTag ? (
                      <Tag variant={changeTag.variant}>{changeTag.label}</Tag>
                    ) : undefined
                  }
                >
                  <Grid
                    columns="minmax(60px, auto) minmax(0, 1fr)"
                    gap="xl"
                    align="center"
                    width="100%"
                  >
                    <Flex gap="md" align="center">
                      <Text size="sm" monospace variant="success">
                        +{file.additions}
                      </Text>
                      <Text size="sm" monospace variant="danger">
                        -{file.deletions}
                      </Text>
                    </Flex>
                    <FilePath size="sm" monospace ellipsis title={file.path}>
                      {file.path}
                    </FilePath>
                  </Grid>
                </Disclosure.Title>
                <Disclosure.Content>
                  {isExpanded ? (
                    <FileDiff
                      file={file}
                      diff={diff}
                      isPending={isPending}
                      isError={isError}
                    />
                  ) : null}
                </Disclosure.Content>
              </Disclosure>
            </FileRow>
          );
        })}
      </Container>
    </Stack>
  );
}

const FileRow = styled('div')`
  & + & {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

// Truncates the head of the path so the file name stays visible.
const FilePath = styled(Text)`
  direction: rtl;
  text-align: left;
`;
