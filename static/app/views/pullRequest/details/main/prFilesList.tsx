import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text/heading';
import {Text} from 'sentry/components/core/text/text';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {
  PRCommentsData,
  PullRequestDetailsSuccessResponse,
} from 'sentry/views/pullRequest/types/pullRequestDetailsTypes';

type PRFileData = PullRequestDetailsSuccessResponse['files'][number];

interface ParsedDiffLine {
  content: string;
  type: 'addition' | 'deletion' | 'context' | 'header';
  newLineNumber?: number;
  oldLineNumber?: number;
}

function parsePatch(patch: string): ParsedDiffLine[] {
  const lines = patch.split('\n');
  const parsedLines: ParsedDiffLine[] = [];
  let oldLineNumber = 0;
  let newLineNumber = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match?.[1] && match[2]) {
        oldLineNumber = parseInt(match[1], 10);
        newLineNumber = parseInt(match[2], 10);
      }
      parsedLines.push({
        content: line,
        type: 'header',
      });
    } else if (line.startsWith('+')) {
      parsedLines.push({
        content: line.slice(1), // Remove leading +
        type: 'addition',
        newLineNumber: newLineNumber++,
      });
    } else if (line.startsWith('-')) {
      parsedLines.push({
        content: line.slice(1), // Remove leading -
        type: 'deletion',
        oldLineNumber: oldLineNumber++,
      });
    } else {
      parsedLines.push({
        content: line.startsWith(' ') ? line.slice(1) : line, // Remove leading space for context lines
        type: 'context',
        oldLineNumber: oldLineNumber++,
        newLineNumber: newLineNumber++,
      });
    }
  }

  return parsedLines;
}

interface PRFilesListProps {
  commentsData: PRCommentsData | null;
  files: PRFileData[];
}

function PRFilesList({files, commentsData}: PRFilesListProps) {
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});

  // Use filename as key instead of index for more stable state
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    files.forEach(file => {
      initialExpanded[file.filename] = true;
    });
    setExpandedFiles(initialExpanded);
  }, [files]);

  const toggleFileExpanded = useCallback((filename: string) => {
    setExpandedFiles(prev => ({
      ...prev,
      [filename]: !prev[filename],
    }));
  }, []);

  const totalStats = useMemo(() => {
    return files.reduce(
      (acc, file) => ({
        additions: acc.additions + file.additions,
        deletions: acc.deletions + file.deletions,
      }),
      {additions: 0, deletions: 0}
    );
  }, [files]);

  if (!files.length) {
    return null;
  }

  return (
    <Flex direction="column" gap="md">
      <Heading as="h2" size="md">
        Files ({files.length}){' '}
        <FileStats>
          +{totalStats.additions} -{totalStats.deletions}
        </FileStats>
      </Heading>
      {files.map(file => {
        const isExpanded = expandedFiles[file.filename] ?? true;
        const fileComments = commentsData?.file_comments[file.filename] || [];

        return (
          <PRFileItem key={file.filename}>
            <PRFileHeader onClick={() => toggleFileExpanded(file.filename)}>
              <PRFileHeaderLeft align="center" gap="md">
                <CollapseIcon direction={isExpanded ? 'down' : 'right'} size="xs" />
                <PRFileName>{file.filename}</PRFileName>
                {fileComments.length > 0 && (
                  <CommentsCount>
                    {fileComments.length} comment{fileComments.length === 1 ? '' : 's'}
                  </CommentsCount>
                )}
              </PRFileHeaderLeft>
              <PRFileStats gap="md">
                <AdditionCount>+{file.additions}</AdditionCount>
                <DeletionCount>-{file.deletions}</DeletionCount>
                <Text size="xs" monospace>
                  ({file.status})
                </Text>
              </PRFileStats>
            </PRFileHeader>
            {isExpanded && file.patch && (
              <PRFileDiff>
                <DiffTable>
                  <tbody>
                    {parsePatch(file.patch).map((line, lineIndex) => {
                      return (
                        <Fragment key={`${file.filename}-${lineIndex}`}>
                          <DiffRow className={`diff-line ${line.type}`}>
                            <LineNumber className="old-line-number">
                              {line.oldLineNumber || ''}
                            </LineNumber>
                            <LineNumber className="new-line-number">
                              {line.newLineNumber || ''}
                            </LineNumber>
                            <DiffContent className={line.type}>
                              <code>{line.content}</code>
                            </DiffContent>
                          </DiffRow>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </DiffTable>
              </PRFileDiff>
            )}
          </PRFileItem>
        );
      })}
    </Flex>
  );
}

const PRFileItem = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background};
`;

const PRFileHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(0.75)} ${space(1.5)};
  background: ${p => p.theme.backgroundElevated};
  border-bottom: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: ${p => p.theme.gray100};
  }
`;

const PRFileHeaderLeft = styled(Flex)``;

const CollapseIcon = styled(IconChevron)`
  color: ${p => p.theme.gray300};
  transition: transform 0.2s ease;
`;

const PRFileStats = styled(Flex)`
  font-size: 11px;
  align-items: center;
`;

const PRFileName = styled(Text)`
  font-family: ${p => p.theme.text.familyMono};
  font-size: 12px;
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const CommentsCount = styled('span')`
  background: ${p => p.theme.blue100};
  color: ${p => p.theme.blue300};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
  padding: ${space(0.25)} ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};
`;

const AdditionCount = styled('span')`
  color: ${p => p.theme.successText};
`;

const DeletionCount = styled('span')`
  color: ${p => p.theme.errorText};
`;

const PRFileDiff = styled('div')`
  background: ${p => p.theme.background};
  overflow-x: auto;
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
`;

const DiffTable = styled('table')`
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  font-family: ${p => p.theme.text.familyMono};
  margin: 0;
`;

const DiffRow = styled('tr')`
  &.addition {
    background-color: ${p => p.theme.green200};

    td {
      color: ${p => p.theme.gray500};

      &:not(.old-line-number):not(.new-line-number) {
        background-color: ${p => p.theme.green200};
        border-left: 3px solid ${p => p.theme.green300};
      }
    }

    .old-line-number {
      background-color: ${p => p.theme.backgroundElevated};
      color: ${p => p.theme.subText};
    }
    .new-line-number {
      background-color: ${p => p.theme.green200};
      color: ${p => p.theme.subText};
    }
  }

  &.deletion {
    background-color: ${p => p.theme.red100};

    td {
      color: ${p => p.theme.gray500};

      &:not(.old-line-number):not(.new-line-number) {
        background-color: ${p => p.theme.red100};
        border-left: 3px solid ${p => p.theme.red300};
      }
    }

    .old-line-number,
    .new-line-number {
      background-color: ${p => p.theme.red200};
      color: ${p => p.theme.subText};
    }
  }

  &.context {
    background-color: ${p => p.theme.background};

    td {
      color: ${p => p.theme.gray400};
    }
  }

  &.header {
    background-color: ${p => p.theme.backgroundSecondary};

    td {
      color: ${p => p.theme.purple300};
      font-weight: ${p => p.theme.fontWeight.bold};
    }
  }
`;

const LineNumber = styled('td')`
  width: 50px;
  padding: ${space(0.25)} ${space(1)};
  text-align: right;
  border-right: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.backgroundElevated};
  color: ${p => p.theme.subText};
  font-size: 10px;
  user-select: none;
  vertical-align: top;

  &.old-line-number {
    border-right: 1px solid ${p => p.theme.border};
  }

  &.new-line-number {
    border-right: 2px solid ${p => p.theme.border};
  }
`;

const DiffContent = styled('td')`
  padding: ${space(0.25)} ${space(1)};
  white-space: pre;
  line-height: 1.4;
  vertical-align: top;

  code {
    background: none;
    padding: 0;
    font-family: inherit;
    font-size: inherit;
  }
`;

const FileStats = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.subText};
  margin-left: ${space(1)};
`;

export default PRFilesList;
