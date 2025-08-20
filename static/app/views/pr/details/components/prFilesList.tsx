import React, {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text/heading';
import {Text} from 'sentry/components/core/text/text';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import CommentsList from './commentsList';
import type {GitHubComment, PRCommentsData, PRFileData} from './types';

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
      // Parse hunk header like "@@ -1,4 +1,6 @@"
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLineNumber = parseInt(match[1], 10);
        newLineNumber = parseInt(match[2], 10);
      }
      parsedLines.push({
        content: line,
        type: 'header',
      });
    } else if (line.startsWith('+')) {
      parsedLines.push({
        content: line,
        type: 'addition',
        newLineNumber: newLineNumber++,
      });
    } else if (line.startsWith('-')) {
      parsedLines.push({
        content: line,
        type: 'deletion',
        oldLineNumber: oldLineNumber++,
      });
    } else {
      // Context line
      parsedLines.push({
        content: line,
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
  const [expandedFiles, setExpandedFiles] = useState<Record<number, boolean>>({});

  // Group comments by file and line number for inline display
  const getCommentsForLine = (
    filename: string,
    lineNumber: number | undefined
  ): GitHubComment[] => {
    if (!commentsData?.file_comments[filename] || !lineNumber) {
      return [];
    }
    return commentsData.file_comments[filename].filter(
      comment => comment.line === lineNumber || comment.original_line === lineNumber
    );
  };

  // Initialize all files as expanded when files change
  useEffect(() => {
    const initialExpanded: Record<number, boolean> = {};
    files.forEach((_, index) => {
      initialExpanded[index] = true;
    });
    setExpandedFiles(initialExpanded);
  }, [files]);

  const toggleFileExpanded = useCallback((index: number) => {
    setExpandedFiles(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  if (!files.length) return null;

  return (
    <Flex direction="column" gap="md">
      <Heading as="h2" size="md">
        Files ({files.length})
      </Heading>
      {files.map((file, index) => {
        const isExpanded = expandedFiles[index] ?? true;
        const fileComments = commentsData?.file_comments[file.filename] || [];

        return (
          <PRFileItem key={index}>
            <PRFileHeader onClick={() => toggleFileExpanded(index)}>
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
            {isExpanded && (
              <React.Fragment>
                {file.patch && (
                  <PRFileDiff>
                    <DiffTable>
                      <tbody>
                        {parsePatch(file.patch).map((line, lineIndex) => {
                          // Get comments for this line (check both old and new line numbers)
                          const oldLineComments = getCommentsForLine(
                            file.filename,
                            line.oldLineNumber
                          );
                          const newLineComments = getCommentsForLine(
                            file.filename,
                            line.newLineNumber
                          );
                          const lineComments = [...oldLineComments, ...newLineComments];
                          // Remove duplicates by comment ID
                          const uniqueComments = lineComments.filter(
                            (comment, commentIndex, array) =>
                              array.findIndex(c => c.id === comment.id) === commentIndex
                          );

                          return (
                            <React.Fragment key={lineIndex}>
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
                              {uniqueComments.length > 0 && (
                                <CommentRow>
                                  <td colSpan={3}>
                                    <InlineCommentsContainer>
                                      <CommentsList
                                        comments={uniqueComments}
                                        title=""
                                        showLineNumbers={false}
                                        filename={file.filename}
                                      />
                                    </InlineCommentsContainer>
                                  </td>
                                </CommentRow>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </DiffTable>
                  </PRFileDiff>
                )}
              </React.Fragment>
            )}
          </PRFileItem>
        );
      })}
    </Flex>
  );
}

const PRFileItem = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  background: ${p => p.theme.background};
`;

const PRFileHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  background: ${p => p.theme.backgroundElevated};
  border-bottom: 1px solid ${p => p.theme.border};
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
  font-size: ${p => p.theme.fontSize.xs};
`;

const PRFileName = styled(Text)`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
`;

const CommentsCount = styled('span')`
  background: ${p => p.theme.blue100};
  color: ${p => p.theme.blue300};
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: 500;
  padding: ${space(0.25)} ${space(0.5)};
  border-radius: 4px;
`;

const AdditionCount = styled('span')`
  color: ${p => p.theme.green400};
`;

const DeletionCount = styled('span')`
  color: ${p => p.theme.red400};
`;

const PRFileDiff = styled('div')`
  background: ${p => p.theme.background};
  overflow-x: auto;
`;

const DiffTable = styled('table')`
  width: 100%;
  border-collapse: collapse;
  font-size: ${p => p.theme.fontSize.xs};
  font-family: ${p => p.theme.text.familyMono};
  margin: 0;
`;

const DiffRow = styled('tr')`
  &.addition {
    background-color: #cdffd8; /* Much more vibrant green */

    td {
      color: #1a7f37; /* Dark green text for contrast */

      &:not(.old-line-number):not(.new-line-number) {
        background-color: #cdffd8;
        border-left: 3px solid #2da44e; /* Green left border for emphasis */
      }
    }

    /* Keep line numbers with neutral background */
    .old-line-number {
      background-color: ${p => p.theme.backgroundElevated} !important;
      color: ${p => p.theme.gray400} !important;
    }
    .new-line-number {
      background-color: #f6fff8 !important;
      color: ${p => p.theme.gray400} !important;
    }
  }

  &.deletion {
    background-color: #ffdce0; /* Much more vibrant red */

    td {
      color: #cf222e; /* Dark red text for contrast */

      &:not(.old-line-number):not(.new-line-number) {
        background-color: #ffdce0;
        border-left: 3px solid #da3633; /* Red left border for emphasis */
      }
    }

    /* Keep line numbers with neutral background */
    .old-line-number,
    .new-line-number {
      background-color: #fff8f8 !important; /* Very light red tint */
      color: ${p => p.theme.gray400} !important;
    }
  }

  &.context {
    background-color: ${p => p.theme.background};

    td {
      color: ${p => p.theme.textColor};
    }
  }

  &.header {
    background-color: ${p => p.theme.backgroundSecondary};

    td {
      color: ${p => p.theme.purple300};
      font-weight: 600;
    }
  }
`;

const LineNumber = styled('td')`
  width: 50px;
  padding: 1px 8px;
  text-align: right;
  border-right: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.backgroundElevated};
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSize.xs};
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
  padding: 1px 8px;
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

const CommentRow = styled('tr')`
  &.diff-line {
    background: none !important;
  }

  td {
    padding: 0 !important;
    border: none !important;
    background: none !important;
  }
`;

const InlineCommentsContainer = styled('div')`
  background: ${p => p.theme.backgroundElevated};
  border-top: 1px solid ${p => p.theme.border};
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${space(1)};
  margin: 0;

  /* Override the CommentsList margins for inline display */
  > div {
    margin-bottom: 0;
  }

  /* Make the comment items more compact for inline display */
  > div > div {
    margin-bottom: ${space(0.5)};
    border-radius: 4px;
    font-size: ${p => p.theme.fontSize.xs};

    &:last-child {
      margin-bottom: 0;
    }
  }

  /* Smaller header text for inline comments */
  h3 {
    display: none; /* Hide the title for inline comments */
  }
`;

export default PRFilesList;
