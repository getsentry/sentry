import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {PullRequestFileChangeType} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

import type {FileChangeTag} from './changedFileRow';
import {ChangedFilesSection, useExpandedKeys} from './changedFilesSection';
import {parseFilePatch} from './filePatch';
import {
  type OverviewPullRequest,
  type OverviewPullRequestFile,
  type PullRequestFileDiff,
  type PullRequestFilesResponse,
  QUERY_STALE_TIME,
} from './types';

const FILE_CHANGE_TAG: Record<PullRequestFileChangeType, FileChangeTag> = {
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
  const {expandedKeys, toggle} = useExpandedKeys();

  const {data, isPending, isError} = useQuery({
    ...apiOptions.as<PullRequestFilesResponse>()(
      '/organizations/$organizationIdOrSlug/pull-requests/$pullRequestId/files/',
      {
        path: {organizationIdOrSlug: orgSlug, pullRequestId: pullRequest.id},
        staleTime: QUERY_STALE_TIME,
      }
    ),
    enabled: expandedKeys.size > 0,
  });

  const diffByPath = useMemo(
    () => new Map((data?.files ?? []).map(file => [file.path, file])),
    [data]
  );

  const groups = [
    {
      repoName: pullRequest.repoName || null,
      files: files.map(file => ({
        additions: file.additions,
        deletions: file.deletions,
        path: file.path,
        changeTag: file.changeType ? FILE_CHANGE_TAG[file.changeType] : null,
        renderDiff: () => (
          <FileDiff
            file={file}
            diff={diffByPath.get(file.path)}
            isPending={isPending}
            isError={isError}
          />
        ),
      })),
    },
  ];

  return (
    <ChangedFilesSection groups={groups} expandedKeys={expandedKeys} onToggle={toggle} />
  );
}
