import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {
  DiffFileType,
  DiffLineType,
  type DiffLine,
  type FilePatch,
} from 'sentry/components/events/autofix/types';
import {DIFF_COLORS} from 'sentry/components/splitDiff';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getPrismLanguage} from 'sentry/utils/prism';
import {usePrismTokens} from 'sentry/utils/usePrismTokens';

interface FileDiffViewerProps {
  patch: FilePatch;
  /**
   * Whether the file diff can be collapsed/expanded by clicking the header.
   * Default: false
   */
  collapsible?: boolean;
  /**
   * Whether the file diff should be expanded by default when collapsible is true.
   * Default: false (collapsed by default)
   */
  defaultExpanded?: boolean;
  /**
   * Optional repo name to display in the file header.
   * If provided, will show as "repoName:filePath", otherwise just "filePath"
   */
  repoName?: string;
  /**
   * Whether to show border and border-radius on the wrapper.
   * Default: false
   */
  showBorder?: boolean;
  /**
   * Whether to use Flex component for deleted file message.
   * Default: false (uses styled div)
   */
  useFlexForDeleted?: boolean;
}

function detectLanguageFromPath(filePath: string): string {
  if (!filePath) {
    return 'plaintext';
  }
  const extension = filePath.split('.').pop()?.toLowerCase();
  if (!extension) {
    return 'plaintext';
  }

  const language = getPrismLanguage(extension);
  return language || 'plaintext';
}

function DiffLineContent({line, fileName}: {line: DiffLine; fileName?: string}) {
  const language = useMemo(
    () => (fileName ? detectLanguageFromPath(fileName) : 'plaintext'),
    [fileName]
  );

  const tokens = usePrismTokens({code: line.value, language});

  return (
    <SyntaxHighlightedCode>
      <pre className={`language-${language}`}>
        <code>
          {tokens.map((lineTokens, i) => (
            <Fragment key={i}>
              {lineTokens.map((token, j) => (
                <span key={j} className={token.className}>
                  {token.children}
                </span>
              ))}
            </Fragment>
          ))}
        </code>
      </pre>
    </SyntaxHighlightedCode>
  );
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

export function FileDiffViewer({
  patch,
  repoName,
  showBorder = false,
  useFlexForDeleted = false,
  collapsible = false,
  defaultExpanded = false,
}: FileDiffViewerProps) {
  const [isExpanded, setIsExpanded] = useState(collapsible ? defaultExpanded : true);
  const isDelete = patch.type === DiffFileType.DELETED;
  const filePath = repoName ? `${repoName}:${patch.path}` : patch.path;

  return (
    <FileDiffWrapper showBorder={showBorder}>
      <FileHeader
        collapsible={collapsible}
        onClick={collapsible ? () => setIsExpanded(value => !value) : undefined}
      >
        {collapsible && <InteractionStateLayer />}
        <FileAddedRemoved>
          <FileAdded>+{patch.added}</FileAdded>
          <FileRemoved>-{patch.removed}</FileRemoved>
        </FileAddedRemoved>
        <FilePathName title={filePath}>{filePath}</FilePathName>
        {collapsible && <IconChevron size="xs" direction={isExpanded ? 'up' : 'down'} />}
      </FileHeader>
      {isExpanded && (
        <Fragment>
          {isDelete ? (
            useFlexForDeleted ? (
              <Flex align="center" justify="center" padding="3xl">
                <Text variant="muted">{t('This file will be deleted.')}</Text>
              </Flex>
            ) : (
              <DeletedFileMessage>{t('This file will be deleted.')}</DeletedFileMessage>
            )
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
                      <LineNumber lineType={line.line_type}>
                        {line.source_line_no}
                      </LineNumber>
                      <LineNumber lineType={line.line_type}>
                        {line.target_line_no}
                      </LineNumber>
                      <DiffContent lineType={line.line_type}>
                        <DiffLineContent line={line} fileName={patch.path} />
                      </DiffContent>
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </DiffContainer>
          )}
        </Fragment>
      )}
    </FileDiffWrapper>
  );
}

const SyntaxHighlightedCode = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  white-space: pre;

  && pre,
  && code {
    margin: 0;
    padding: 0;
    background: transparent;
  }
`;

const FileDiffWrapper = styled('div')<{showBorder?: boolean}>`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 20px;
  vertical-align: middle;
  overflow: hidden;
  background-color: ${p => p.theme.background};
  ${p => (p.showBorder ? `border: 1px solid ${p.theme.border};` : '')}
  ${p => (p.showBorder ? `border-radius: ${p.theme.radius.md};` : '')}
`;

const FileHeader = styled('div')<{collapsible?: boolean}>`
  position: relative;
  display: grid;
  align-items: center;
  grid-template-columns: minmax(60px, auto) 1fr ${p => (p.collapsible ? 'auto' : '')};
  gap: ${p => p.theme.space.xl};
  background-color: ${p => p.theme.backgroundSecondary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  ${p => (p.collapsible ? 'cursor: pointer;' : '')}
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

const FilePathName = styled('div')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  direction: rtl;
  text-align: left;
`;

const DeletedFileMessage = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space['2xl']};
  color: ${p => p.theme.subText};
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
