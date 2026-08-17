import {DiffFileType} from 'sentry/components/events/autofix/types';
import {t} from 'sentry/locale';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

import type {FileChangeTag} from './changedFileRow';
import {
  ChangedFilesSection,
  type RepoFileGroup,
  useExpandedKeys,
} from './changedFilesSection';
import type {OverviewCodeChangeFile} from './types';

const DIFF_TYPE_TAG: Record<DiffFileType, FileChangeTag> = {
  [DiffFileType.ADDED]: {label: t('Added'), variant: 'success'},
  [DiffFileType.MODIFIED]: {label: t('Modified'), variant: 'muted'},
  [DiffFileType.DELETED]: {label: t('Deleted'), variant: 'danger'},
};

function groupByRepo(codeChanges: OverviewCodeChangeFile[]): RepoFileGroup[] {
  const groups = new Map<string | null, RepoFileGroup>();
  for (const {repoName: rawRepoName, patch} of codeChanges) {
    const repoName = rawRepoName || null;
    const group = groups.get(repoName) ?? {repoName, files: []};
    group.files.push({
      additions: patch.added,
      deletions: patch.removed,
      path: patch.path,
      changeTag: DIFF_TYPE_TAG[patch.type],
      renderDiff: () => <FileDiffViewer hideHeader patch={patch} />,
    });
    groups.set(repoName, group);
  }
  return [...groups.values()];
}

export function CodeChanges({codeChanges}: {codeChanges: OverviewCodeChangeFile[]}) {
  const {expandedKeys, toggle} = useExpandedKeys();
  return (
    <ChangedFilesSection
      groups={groupByRepo(codeChanges)}
      expandedKeys={expandedKeys}
      onToggle={toggle}
    />
  );
}
