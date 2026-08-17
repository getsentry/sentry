import {useState} from 'react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DiffFileType} from 'sentry/components/events/autofix/types';
import {IconCode} from 'sentry/icons';
import {t} from 'sentry/locale';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

import {ChangedFileRow, type FileChangeTag} from './changedFileRow';
import type {OverviewCodeChangeFile} from './types';

const DIFF_TYPE_TAG: Record<DiffFileType, FileChangeTag> = {
  [DiffFileType.ADDED]: {label: t('Added'), variant: 'success'},
  [DiffFileType.MODIFIED]: {label: t('Modified'), variant: 'muted'},
  [DiffFileType.DELETED]: {label: t('Deleted'), variant: 'danger'},
};

export function CodeChanges({codeChanges}: {codeChanges: OverviewCodeChangeFile[]}) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set());

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
        {codeChanges.length === 1
          ? t('1 file changed')
          : t('%s files changed', codeChanges.length.toLocaleString())}
      </Text>
      <Container border="primary" radius="md" overflow="hidden" background="secondary">
        {codeChanges.map(({patch}, index) => {
          const isExpanded = expandedRows.has(index);
          return (
            <ChangedFileRow
              key={`${index}-${patch.path}`}
              additions={patch.added}
              deletions={patch.removed}
              path={patch.path}
              changeTag={DIFF_TYPE_TAG[patch.type]}
              expanded={isExpanded}
              onExpandedChange={next => toggle(index, next)}
            >
              {isExpanded ? <FileDiffViewer hideHeader patch={patch} /> : null}
            </ChangedFileRow>
          );
        })}
      </Container>
    </Stack>
  );
}
