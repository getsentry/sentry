import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Container, Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text/heading';
import {Text} from 'sentry/components/core/text/text';
import {IconChevron} from 'sentry/icons';
import type {PullRequestDetailsSuccessResponse} from 'sentry/views/pullRequest/types/pullRequestDetailsTypes';

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
  files: PRFileData[];
}

function PRFilesList({files}: PRFilesListProps) {
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
      <Flex align="center" gap="sm">
        <Heading as="h2" size="md">
          Files ({files.length})
        </Heading>
        <Text size="sm" variant="muted">
          +{totalStats.additions} -{totalStats.deletions}
        </Text>
      </Flex>
      {files.map(file => {
        const isExpanded = expandedFiles[file.filename] ?? true;

        return (
          <Container
            key={file.filename}
            border="primary"
            radius="md"
            background="secondary"
          >
            <Flex
              justify="between"
              align="center"
              padding="sm lg"
              background="secondary"
              borderBottom="primary"
              radius="md md 0 0"
              style={{cursor: 'pointer', userSelect: 'none'}}
              onClick={() => toggleFileExpanded(file.filename)}
            >
              <Flex align="center" gap="md">
                <CollapseIcon direction={isExpanded ? 'down' : 'right'} size="xs" />
                <Text monospace size="sm" bold>
                  {file.filename}
                </Text>
              </Flex>
              <Flex gap="md" align="center">
                <Text size="xs" variant="success">
                  +{file.additions}
                </Text>
                <Text size="xs" variant="danger">
                  -{file.deletions}
                </Text>
                <Text size="xs" monospace>
                  ({file.status})
                </Text>
              </Flex>
            </Flex>
            {isExpanded && file.patch && (
              <Container background="secondary" overflowX="auto" radius="0 0 md md">
                <DiffTable>
                  <tbody>
                    {parsePatch(file.patch).map((line, lineIndex) => {
                      return (
                        <Fragment key={`${file.filename}-${lineIndex}`}>
                          <DiffRow className={line.type}>
                            <LineNumber className="old-line-number">
                              {line.oldLineNumber || ''}
                            </LineNumber>
                            <LineNumber className="new-line-number">
                              {line.newLineNumber || ''}
                            </LineNumber>
                            <DiffContent>
                              <code>{line.content}</code>
                            </DiffContent>
                          </DiffRow>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </DiffTable>
              </Container>
            )}
          </Container>
        );
      })}
    </Flex>
  );
}

const CollapseIcon = styled(IconChevron)`
  color: ${p => p.theme.colors.gray400};
  transition: transform 0.2s ease;
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
    background-color: #e6ffec;

    td {
      color: ${p => p.theme.colors.gray800};

      &:not(.old-line-number):not(.new-line-number) {
        background-color: #d1f4db;
        border-left: 3px solid #28a745;
      }
    }

    .old-line-number {
      background-color: ${p => p.theme.tokens.background.primary};
      color: ${p => p.theme.subText};
    }
    .new-line-number {
      background-color: #d1f4db;
      color: ${p => p.theme.subText};
    }
  }

  &.deletion {
    background-color: #ffebe9;

    td {
      color: ${p => p.theme.colors.gray800};

      &:not(.old-line-number):not(.new-line-number) {
        background-color: #ffd7d5;
        border-left: 3px solid #d73a49;
      }
    }

    .old-line-number,
    .new-line-number {
      background-color: #ffd7d5;
      color: ${p => p.theme.subText};
    }
  }

  &.context {
    background-color: ${p => p.theme.tokens.background.primary};

    td {
      color: ${p => p.theme.colors.gray500};
    }
  }

  &.header {
    background-color: ${p => p.theme.backgroundSecondary};

    td {
      color: ${p => p.theme.colors.blue400};
      font-weight: ${p => p.theme.fontWeight.bold};
    }
  }
`;

const LineNumber = styled('td')`
  width: 50px;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  text-align: right;
  border-right: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.tokens.background.primary};
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
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
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

export default PRFilesList;
