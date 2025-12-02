import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {
  DiffFileType,
  DiffLineType,
  type DiffLine,
  type FilePatch,
} from 'sentry/components/events/autofix/types';
import {DIFF_COLORS} from 'sentry/components/splitDiff';
import {t} from 'sentry/locale';
import type {PendingUserInput} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';

interface PendingFilePatch {
  patch: FilePatch;
  repo_name: string;
}

interface FileChangeApprovalData {
  patches: PendingFilePatch[];
}

interface FileChangeApprovalProps {
  onSubmit: (decisions: boolean[]) => void;
  isMinimized?: boolean;
  pendingInput?: PendingUserInput | null;
}

function DiffLineContent({line}: {line: DiffLine}) {
  return <span>{line.value}</span>;
}

function HunkHeader({
  sectionHeader,
  sourceLength,
  sourceStart,
  targetLength,
  targetStart,
}: {
  sectionHeader: string;
  sourceLength: number;
  sourceStart: number;
  targetLength: number;
  targetStart: number;
}) {
  return (
    <HunkHeaderContent>{`@@ -${sourceStart},${sourceLength} +${targetStart},${targetLength} @@ ${sectionHeader ? ' ' + sectionHeader : ''}`}</HunkHeaderContent>
  );
}

function FileDiffView({patch, repoName}: {patch: FilePatch; repoName: string}) {
  const isDelete = patch.type === DiffFileType.DELETED;

  return (
    <FileDiffWrapper>
      <FileHeader>
        <FileAddedRemoved>
          <FileAdded>+{patch.added}</FileAdded>
          <FileRemoved>-{patch.removed}</FileRemoved>
        </FileAddedRemoved>
        <FileName title={`${repoName}:${patch.path}`}>
          {repoName}:{patch.path}
        </FileName>
      </FileHeader>
      {isDelete ? (
        <DeleteMessage>
          <Text variant="muted">{t('This file will be deleted.')}</Text>
        </DeleteMessage>
      ) : (
        <DiffContainer>
          {patch.hunks.map((hunk, hunkIndex) => (
            <Fragment key={hunkIndex}>
              <HunkHeaderEmptySpace />
              <HunkHeader
                sourceStart={hunk.source_start}
                sourceLength={hunk.source_length}
                targetStart={hunk.target_start}
                targetLength={hunk.target_length}
                sectionHeader={hunk.section_header}
              />
              {hunk.lines.map((line, lineIndex) => (
                <Fragment key={`${hunkIndex}-${lineIndex}`}>
                  <LineNumber lineType={line.line_type}>{line.source_line_no}</LineNumber>
                  <LineNumber lineType={line.line_type}>{line.target_line_no}</LineNumber>
                  <DiffContent lineType={line.line_type}>
                    <DiffLineContent line={line} />
                  </DiffContent>
                </Fragment>
              ))}
            </Fragment>
          ))}
        </DiffContainer>
      )}
    </FileDiffWrapper>
  );
}

function FileChangeApproval({
  onSubmit,
  isMinimized = false,
  pendingInput,
}: FileChangeApprovalProps) {
  // Track current index and decisions locally
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<boolean[]>([]);

  // Reset local state when pendingInput changes (new batch of patches)
  useEffect(() => {
    setCurrentIndex(0);
    setDecisions([]);
  }, [pendingInput?.id]);

  const data = useMemo(() => {
    if (!pendingInput || pendingInput.input_type !== 'file_change_approval') {
      return null;
    }
    return pendingInput.data as FileChangeApprovalData;
  }, [pendingInput]);

  const patches = data?.patches ?? [];
  const totalPatches = patches.length;

  const handleDecision = useCallback(
    (approved: boolean) => {
      const newDecisions = [...decisions, approved];
      const nextIndex = currentIndex + 1;

      setDecisions(newDecisions);
      setCurrentIndex(nextIndex);

      if (nextIndex >= totalPatches) {
        // All patches reviewed - submit to backend
        const allApproved = newDecisions.every(d => d);
        const countRejected = newDecisions.filter(d => !d).length;
        if (!allApproved) {
          addErrorMessage(
            t(
              'You rejected %s change(s). Tell Seer what to do instead to continue.',
              countRejected
            )
          );
        }
        onSubmit(newDecisions);
      }
    },
    [decisions, currentIndex, totalPatches, onSubmit]
  );

  const handleApprove = useCallback(() => handleDecision(true), [handleDecision]);
  const handleReject = useCallback(() => handleDecision(false), [handleDecision]);

  // Add keyboard shortcuts for approve (Enter) and reject (Backspace/Delete)
  useEffect(() => {
    if (
      !pendingInput ||
      pendingInput.input_type !== 'file_change_approval' ||
      isMinimized
    ) {
      return undefined;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleApprove();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleReject();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pendingInput, handleApprove, handleReject, isMinimized]);

  if (!pendingInput || pendingInput.input_type !== 'file_change_approval') {
    return null;
  }

  if (!patches || patches.length === 0 || currentIndex >= patches.length) {
    return null;
  }

  const currentPatch = patches[currentIndex]!;
  const hasMultiple = totalPatches > 1;

  return (
    <Wrapper
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      exit={{opacity: 0, y: 20}}
      transition={{duration: 0.2, ease: 'easeOut'}}
    >
      <DiffScrollContainer>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{opacity: 0, x: 20}}
            animate={{opacity: 1, x: 0}}
            exit={{opacity: 0, x: -20}}
            transition={{duration: 0.12, ease: 'easeOut'}}
          >
            <FileDiffView patch={currentPatch.patch} repoName={currentPatch.repo_name} />
          </motion.div>
        </AnimatePresence>
      </DiffScrollContainer>
      <ActionBar
        initial={{opacity: 0, y: 10}}
        animate={{opacity: 1, y: 0}}
        transition={{duration: 0.12, delay: 0.1, ease: 'easeOut'}}
      >
        <Container borderTop="primary" padding="md" background="secondary">
          <Flex justify="between" align="center">
            <Flex align="center" gap="md" paddingLeft="md">
              <Text size="md" bold>
                {t('Reviewing Changes')}
              </Text>
              {hasMultiple && (
                <Text size="md" variant="muted">
                  {t('(%s of %s)', currentIndex + 1, totalPatches)}
                </Text>
              )}
            </Flex>
            <ButtonBar gap="md">
              <Button size="md" onClick={handleReject}>
                {t('Reject')} ⌫
              </Button>
              <Button size="md" priority="primary" onClick={handleApprove}>
                {t('Approve')} ⏎
              </Button>
            </ButtonBar>
          </Flex>
        </Container>
      </ActionBar>
    </Wrapper>
  );
}

export default FileChangeApproval;

const Wrapper = styled(motion.div)`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const ActionBar = styled(motion.div)`
  flex-shrink: 0;
`;

const DiffScrollContainer = styled('div')`
  flex: 1;
  overflow: auto;
`;

const FileDiffWrapper = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 20px;
  vertical-align: middle;
  overflow: hidden;
  background-color: ${p => p.theme.background};
`;

const FileHeader = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: minmax(60px, auto) 1fr;
  gap: ${p => p.theme.space.xl};
  background-color: ${p => p.theme.backgroundSecondary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
`;

const FileAddedRemoved = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  align-items: center;
`;

const FileAdded = styled('div')`
  color: ${p => p.theme.successText};
`;

const FileRemoved = styled('div')`
  color: ${p => p.theme.errorText};
`;

const FileName = styled('div')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  direction: rtl;
  text-align: left;
`;

const DeleteMessage = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space['3xl']};
`;

const DiffContainer = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
  display: grid;
  grid-template-columns: auto auto 1fr;
  overflow-x: auto;
`;

const HunkHeaderEmptySpace = styled('div')`
  grid-column: 1 / 3;
  background-color: ${p => p.theme.backgroundSecondary};
`;

const HunkHeaderContent = styled('div')`
  grid-column: 3 / -1;
  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md} ${p => p.theme.space.sm}
    ${p => p.theme.space['3xl']};
  white-space: pre-wrap;
`;

const LineNumber = styled('div')<{lineType: DiffLineType}>`
  display: flex;
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.md};
  user-select: none;

  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};

  ${p =>
    p.lineType === DiffLineType.ADDED &&
    `background-color: ${DIFF_COLORS.added}; color: ${p.theme.textColor}`};
  ${p =>
    p.lineType === DiffLineType.REMOVED &&
    `background-color: ${DIFF_COLORS.removed}; color: ${p.theme.textColor}`};

  & + & {
    padding-left: 0;
  }
`;

const DiffContent = styled('div')<{lineType: DiffLineType}>`
  position: relative;
  padding-left: ${p => p.theme.space['3xl']};
  padding-right: ${p => p.theme.space['3xl']};
  white-space: pre-wrap;
  word-break: break-all;
  word-wrap: break-word;
  overflow: visible;

  ${p =>
    p.lineType === DiffLineType.ADDED &&
    `background-color: ${DIFF_COLORS.addedRow}; color: ${p.theme.textColor}`};
  ${p =>
    p.lineType === DiffLineType.REMOVED &&
    `background-color: ${DIFF_COLORS.removedRow}; color: ${p.theme.textColor}`};

  &::before {
    content: ${p =>
      p.lineType === DiffLineType.ADDED
        ? "'+'"
        : p.lineType === DiffLineType.REMOVED
          ? "'-'"
          : "''"};
    position: absolute;
    top: 1px;
    left: ${p => p.theme.space.md};
  }
`;
