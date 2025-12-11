import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

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

interface FileChangeApprovalBlockProps {
  currentIndex: number;
  pendingInput: PendingUserInput;
  isFocused?: boolean;
  isLast?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
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
        <Flex gap="md" align="center">
          <FileAdded>+{patch.added}</FileAdded>
          <FileRemoved>-{patch.removed}</FileRemoved>
        </Flex>
        <FileName
          title={`${repoName}:${patch.path}`}
        >{`${repoName}:${patch.path}`}</FileName>
      </FileHeader>
      {isDelete ? (
        <Flex align="center" justify="center" padding="3xl">
          <Text variant="muted">{t('This file will be deleted.')}</Text>
        </Flex>
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

function FileChangeApprovalBlock({
  currentIndex,
  isFocused,
  isLast,
  onClick,
  onMouseEnter,
  onMouseLeave,
  pendingInput,
}: FileChangeApprovalBlockProps) {
  const data = useMemo(() => {
    if (!pendingInput || pendingInput.input_type !== 'file_change_approval') {
      return null;
    }
    return pendingInput.data as FileChangeApprovalData;
  }, [pendingInput]);

  const patches = data?.patches ?? [];
  if (!patches || patches.length === 0 || currentIndex >= patches.length) {
    return null;
  }

  const currentPatch = patches[currentIndex]!;

  return (
    <Block
      isFocused={isFocused}
      isLast={isLast}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <AnimatePresence>
        <motion.div
          initial={{opacity: 0, y: 10}}
          animate={{opacity: 1, y: 0}}
          exit={{opacity: 0, y: 10}}
        >
          <Flex align="start" width="100%">
            <BlockContentWrapper>
              <DiffScrollContainer>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    initial={{opacity: 0, x: 20}}
                    animate={{opacity: 1, x: 0}}
                    exit={{opacity: 0, x: -20}}
                    transition={{duration: 0.12, ease: 'easeOut'}}
                  >
                    <FileDiffView
                      patch={currentPatch.patch}
                      repoName={currentPatch.repo_name}
                    />
                  </motion.div>
                </AnimatePresence>
              </DiffScrollContainer>
            </BlockContentWrapper>
          </Flex>
        </motion.div>
      </AnimatePresence>
    </Block>
  );
}

export default FileChangeApprovalBlock;

const Block = styled('div')<{isFocused?: boolean; isLast?: boolean}>`
  width: 100%;
  border-bottom: ${p => (p.isLast ? 'none' : `1px solid ${p.theme.border}`)};
  position: relative;
  flex-shrink: 0;
  cursor: pointer;
  background: ${p => (p.isFocused ? p.theme.hover : 'transparent')};
`;

const BlockContentWrapper = styled('div')`
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

const DiffScrollContainer = styled('div')`
  overflow: auto;
`;

const FileDiffWrapper = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 20px;
  vertical-align: middle;
  overflow: hidden;
  background-color: ${p => p.theme.tokens.background.primary};
`;

const FileHeader = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: minmax(60px, auto) 1fr;
  gap: ${p => p.theme.space.xl};
  background-color: ${p => p.theme.backgroundSecondary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
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
    `background-color: ${DIFF_COLORS.added}; color: ${p.theme.tokens.content.primary}`};
  ${p =>
    p.lineType === DiffLineType.REMOVED &&
    `background-color: ${DIFF_COLORS.removed}; color: ${p.theme.tokens.content.primary}`};

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
    `background-color: ${DIFF_COLORS.addedRow}; color: ${p.theme.tokens.content.primary}`};
  ${p =>
    p.lineType === DiffLineType.REMOVED &&
    `background-color: ${DIFF_COLORS.removedRow}; color: ${p.theme.tokens.content.primary}`};

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
