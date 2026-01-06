import {useMemo} from 'react';
import type React from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconCheckmark, IconOpen, IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {MenuItemProps} from 'sentry/views/seerExplorer/explorerMenu';
import type {Block, RepoPRState} from 'sentry/views/seerExplorer/types';

interface PRWidgetProps {
  blocks: Block[];
  onCreatePR: (repoName?: string) => void;
  onToggleMenu: () => void;
  repoPRStates: Record<string, RepoPRState>;
  ref?: React.Ref<HTMLButtonElement>;
}

interface RepoStats {
  added: number;
  removed: number;
}

interface FileStats {
  added: number;
  path: string;
  removed: number;
}

interface RepoSyncStatus {
  hasPR: boolean;
  isOutOfSync: boolean;
}

export function usePRWidgetData({
  blocks,
  repoPRStates,
  onCreatePR,
}: {
  blocks: Block[];
  onCreatePR: (repoName?: string) => void;
  repoPRStates: Record<string, RepoPRState>;
}) {
  // Compute aggregated stats from merged patches (latest patch per file)
  const {totalAdded, totalRemoved, repoStats, repoFileStats} = useMemo(() => {
    // Collect latest merged patch per file (later blocks override earlier)
    const mergedByFile = new Map<
      string,
      {added: number; path: string; removed: number; repoName: string}
    >();

    for (const block of blocks) {
      if (!block.merged_file_patches) {
        continue;
      }
      for (const filePatch of block.merged_file_patches) {
        const key = `${filePatch.repo_name}:${filePatch.patch.path}`;
        mergedByFile.set(key, {
          repoName: filePatch.repo_name,
          path: filePatch.patch.path,
          added: filePatch.patch.added,
          removed: filePatch.patch.removed,
        });
      }
    }

    // Aggregate stats from merged patches
    const stats: Record<string, RepoStats> = {};
    const fileStats: Record<string, FileStats[]> = {};
    let added = 0;
    let removed = 0;

    for (const patch of mergedByFile.values()) {
      added += patch.added;
      removed += patch.removed;

      if (!stats[patch.repoName]) {
        stats[patch.repoName] = {added: 0, removed: 0};
      }
      const repoStat = stats[patch.repoName];
      if (repoStat) {
        repoStat.added += patch.added;
        repoStat.removed += patch.removed;
      }

      if (!fileStats[patch.repoName]) {
        fileStats[patch.repoName] = [];
      }
      fileStats[patch.repoName]?.push({
        added: patch.added,
        path: patch.path,
        removed: patch.removed,
      });
    }

    return {
      totalAdded: added,
      totalRemoved: removed,
      repoStats: stats,
      repoFileStats: fileStats,
    };
  }, [blocks]);

  // Compute sync status per repo
  const repoSyncStatus = useMemo(() => {
    const status: Record<string, RepoSyncStatus> = {};

    for (const repoName of Object.keys(repoStats)) {
      const prState = repoPRStates[repoName];
      const hasPR = !!(prState?.pr_number && prState?.pr_url);
      let isOutOfSync = !hasPR; // No PR means out of sync

      if (hasPR && prState?.commit_sha) {
        // Find last block with merged patches for this repo
        for (let i = blocks.length - 1; i >= 0; i--) {
          const block = blocks[i];
          if (block?.merged_file_patches?.some(p => p.repo_name === repoName)) {
            const blockSha = block.pr_commit_shas?.[repoName];
            isOutOfSync = blockSha !== prState.commit_sha;
            break;
          }
        }
      }

      status[repoName] = {hasPR, isOutOfSync};
    }

    return status;
  }, [blocks, repoPRStates, repoStats]);

  const repoNames = Object.keys(repoStats);

  // Compute overall sync status
  const {allInSync, anyCreating} = useMemo(() => {
    let inSync = true;
    let creating = false;

    for (const repoName of repoNames) {
      const prState = repoPRStates[repoName];
      const syncStatus = repoSyncStatus[repoName];

      if (prState?.pr_creation_status === 'creating') {
        creating = true;
      }
      if (syncStatus?.isOutOfSync) {
        inSync = false;
      }
    }

    return {
      allInSync: inSync && !creating,
      anyCreating: creating,
    };
  }, [repoNames, repoPRStates, repoSyncStatus]);

  const hasCodeChanges = totalAdded > 0 || totalRemoved > 0;

  // Build menu items for explorer menu
  const menuItems: MenuItemProps[] = useMemo(() => {
    return repoNames.map(repoName => {
      const files = repoFileStats[repoName] || [];
      const prState = repoPRStates[repoName];
      const syncStatus = repoSyncStatus[repoName];
      const isCreating = prState?.pr_creation_status === 'creating';

      return {
        key: repoName,
        title: repoName,
        description: (
          <Flex direction="column" gap="lg">
            <Flex direction="column">
              {files.map((file, idx) => (
                <Flex
                  key={`${file.path}-${idx}`}
                  justify="between"
                  align="center"
                  gap="lg"
                  width="100%"
                >
                  <Flex>
                    <Text variant="success" monospace size="sm">
                      +{file.added}
                    </Text>
                    <Text variant="danger" monospace size="sm">
                      -{file.removed}
                    </Text>
                  </Flex>
                  <Text variant="muted" size="sm" monospace ellipsis>
                    {file.path}
                  </Text>
                </Flex>
              ))}
            </Flex>
            <Flex align="center" gap="md">
              {isCreating ? (
                <Text size="xs" variant="muted">
                  {t('Pushing...')}
                </Text>
              ) : syncStatus?.hasPR ? (
                <Flex align="center" gap="md" justify="between" width="100%">
                  {syncStatus.isOutOfSync ? (
                    <Text size="xs" variant="warning">
                      {t('Not pushed')}
                    </Text>
                  ) : (
                    <Text size="xs" variant="success">
                      {t('Pushed')}
                    </Text>
                  )}
                  <PRLink
                    href={prState?.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                  >
                    <IconOpen size="xs" />#{prState?.pr_number}
                  </PRLink>
                </Flex>
              ) : (
                <Text variant="muted" size="sm">
                  {t('No PR yet')}
                </Text>
              )}
            </Flex>
          </Flex>
        ),
        handler: () => {
          // If repo has a PR, open it
          if (syncStatus?.hasPR && prState?.pr_url) {
            window.open(prState.pr_url, '_blank');
          }
        },
      };
    });
  }, [repoNames, repoFileStats, repoPRStates, repoSyncStatus]);

  // Build footer for explorer menu
  const menuFooter = useMemo(() => {
    const handleCreateAllPRs = () => {
      for (const repoName of repoNames) {
        const syncStatus = repoSyncStatus[repoName];
        if (syncStatus?.isOutOfSync) {
          onCreatePR(repoName);
        }
      }
    };

    return (
      <Flex padding="sm" justify="end">
        {anyCreating ? (
          <Button size="sm" disabled>
            <Flex align="center" gap="md">
              <LoadingIndicator size={12} />
              {t('Pushing...')}
            </Flex>
          </Button>
        ) : allInSync ? (
          <Flex gap="sm">
            <IconCheckmark size="sm" variant="success" />
            <Text variant="success" size="sm">
              {t('All changes pushed')}
            </Text>
          </Flex>
        ) : (
          <Button
            size="sm"
            priority="primary"
            onClick={handleCreateAllPRs}
            icon={<IconUpload />}
          >
            {t('Push All Changes')}
          </Button>
        )}
      </Flex>
    );
  }, [anyCreating, allInSync, repoNames, repoSyncStatus, onCreatePR]);

  return {
    hasCodeChanges,
    totalAdded,
    totalRemoved,
    allInSync,
    anyCreating,
    menuItems,
    menuFooter,
  };
}

function PRWidget({blocks, repoPRStates, onCreatePR, onToggleMenu, ref}: PRWidgetProps) {
  const {hasCodeChanges, totalAdded, totalRemoved, allInSync, anyCreating} =
    usePRWidgetData({
      blocks,
      repoPRStates,
      onCreatePR,
    });

  if (!hasCodeChanges) {
    return null;
  }

  return (
    <Button ref={ref as any} size="xs" onClick={onToggleMenu}>
      <Flex align="center" gap="sm">
        <Flex>
          <Text variant="success" monospace>
            +{totalAdded}
          </Text>
          <Text variant="danger" monospace>
            -{totalRemoved}
          </Text>
        </Flex>
        {anyCreating ? (
          <LoadingIndicator size={12} />
        ) : allInSync ? (
          <IconCheckmark size="xs" variant="success" />
        ) : (
          <Flex gap="xs">
            <Text size="xs">{t('Push')}</Text>
            <IconUpload size="xs" />
          </Flex>
        )}
      </Flex>
    </Button>
  );
}

export default PRWidget;

const PRLink = styled('a')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  color: ${p => p.theme.linkColor};
  font-size: ${p => p.theme.fontSize.sm};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;
