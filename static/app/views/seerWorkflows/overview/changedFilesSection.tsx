import {Fragment, type ReactNode, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconChevron, IconCode} from 'sentry/icons';
import {t, tn} from 'sentry/locale';

import {ChangedFileRow, type FileChangeTag} from './changedFileRow';

const COLLAPSED_FILE_COUNT = 5;

interface ChangedFile {
  additions: number;
  changeTag: FileChangeTag | null;
  deletions: number;
  path: string;
  renderDiff: () => ReactNode;
}

export interface RepoFileGroup {
  files: ChangedFile[];
  repoName: string | null;
}

export function useExpandedKeys() {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const toggle = (key: string, expanded: boolean) =>
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (expanded) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  return {expandedKeys, toggle};
}

function RepoGroup({
  group,
  groupIndex,
  expandedKeys,
  onToggle,
}: {
  expandedKeys: Set<string>;
  group: RepoFileGroup;
  groupIndex: number;
  onToggle: (key: string, expanded: boolean) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const hiddenCount = group.files.length - COLLAPSED_FILE_COUNT;
  const visibleFiles =
    showAll || hiddenCount <= 0
      ? group.files
      : group.files.slice(0, COLLAPSED_FILE_COUNT);

  const fileKey = (path: string) => JSON.stringify([group.repoName, path]);

  const toggleShowAll = () => {
    if (showAll) {
      // Collapsing: forget expanded diffs for files about to be hidden.
      group.files
        .slice(COLLAPSED_FILE_COUNT)
        .forEach(file => onToggle(fileKey(file.path), false));
    }
    setShowAll(prev => !prev);
  };

  return (
    <Fragment>
      <Flex
        gap="md"
        align="center"
        padding="md"
        borderBottom="primary"
        borderTop={groupIndex > 0 ? 'primary' : undefined}
      >
        {group.repoName ? (
          <Text size="sm" bold variant="secondary" ellipsis>
            {group.repoName}
          </Text>
        ) : (
          <Text size="sm" variant="muted">
            {group.files.length === 1
              ? t('1 file changed')
              : t('%s files changed', group.files.length.toLocaleString())}
          </Text>
        )}
      </Flex>
      {visibleFiles.map(file => {
        const key = fileKey(file.path);
        const isExpanded = expandedKeys.has(key);
        return (
          <ChangedFileRow
            key={key}
            additions={file.additions}
            deletions={file.deletions}
            path={file.path}
            changeTag={file.changeTag}
            expanded={isExpanded}
            onExpandedChange={next => onToggle(key, next)}
          >
            {isExpanded ? file.renderDiff() : null}
          </ChangedFileRow>
        );
      })}
      {hiddenCount > 0 ? (
        <Flex justify="center" borderTop="primary" background="primary" padding="xs">
          <Button
            size="xs"
            variant="transparent"
            aria-expanded={showAll}
            icon={<IconChevron isDouble direction={showAll ? 'up' : 'down'} />}
            onClick={toggleShowAll}
          >
            <Text size="sm" variant="muted">
              {showAll
                ? t('Show fewer')
                : tn('Show %s more file', 'Show %s more files', hiddenCount)}
            </Text>
          </Button>
        </Flex>
      ) : null}
    </Fragment>
  );
}

export function ChangedFilesSection({
  groups,
  expandedKeys,
  onToggle,
  onMouseEnter,
}: {
  expandedKeys: Set<string>;
  groups: RepoFileGroup[];
  onToggle: (key: string, expanded: boolean) => void;
  onMouseEnter?: () => void;
}) {
  return (
    <Stack gap="md" onMouseEnter={onMouseEnter}>
      <Flex gap="xs" align="center">
        <IconCode size="xs" variant="secondary" aria-hidden />
        <Text size="xs" bold variant="secondary">
          {t('Code Changes')}
        </Text>
      </Flex>
      <Container border="primary" radius="md" overflow="hidden" background="secondary">
        {groups.map((group, groupIndex) => (
          <RepoGroup
            key={JSON.stringify([group.repoName])}
            group={group}
            groupIndex={groupIndex}
            expandedKeys={expandedKeys}
            onToggle={onToggle}
          />
        ))}
      </Container>
    </Stack>
  );
}
