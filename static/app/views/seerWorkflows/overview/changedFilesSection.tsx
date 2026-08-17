import {Fragment, type ReactNode, useState} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconCode} from 'sentry/icons';
import {t} from 'sentry/locale';

import {ChangedFileRow, type FileChangeTag} from './changedFileRow';

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

export function ChangedFilesSection({
  groups,
  expandedKeys,
  onToggle,
}: {
  expandedKeys: Set<string>;
  groups: RepoFileGroup[];
  onToggle: (key: string, expanded: boolean) => void;
}) {
  return (
    <Stack gap="sm">
      <Flex gap="xs" align="center">
        <IconCode size="xs" variant="secondary" aria-hidden />
        <Text size="xs" bold uppercase variant="secondary">
          {t('Code changes')}
        </Text>
      </Flex>
      <Container border="primary" radius="md" overflow="hidden" background="secondary">
        {groups.map((group, groupIndex) => (
          <Fragment key={groupIndex}>
            <Flex
              gap="md"
              align="center"
              padding="md xl"
              borderBottom="primary"
              borderTop={groupIndex > 0 ? 'primary' : undefined}
            >
              {group.repoName ? (
                <Fragment>
                  <Tag variant="muted">{group.files.length}</Tag>
                  <Text size="sm" monospace variant="secondary" ellipsis>
                    {group.repoName}
                  </Text>
                </Fragment>
              ) : (
                <Text size="sm" variant="muted">
                  {group.files.length === 1
                    ? t('1 file changed')
                    : t('%s files changed', group.files.length.toLocaleString())}
                </Text>
              )}
            </Flex>
            {group.files.map((file, index) => {
              const key = `${groupIndex}:${index}:${file.path}`;
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
          </Fragment>
        ))}
      </Container>
    </Stack>
  );
}
