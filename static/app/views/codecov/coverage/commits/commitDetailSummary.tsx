import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {
  SummaryContainer,
  SummaryEntries,
  SummaryEntry,
  SummaryEntryLabel,
  SummaryEntryValue,
  SummaryEntryValueLink,
} from 'sentry/components/codecov/summary';
import {Link} from 'sentry/components/core/link';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconArrow, IconChevron, IconGithub, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

const headCommit = {
  sha: '31b72ff64bd75326ea5e43bf8e93b415db56cb62',
  shortSha: 'd677638',
};

const baseCommit = {
  sha: 'da46d4c13e4a75b7624c8c6763816ecb6dad1968',
  shortSha: 'da46d4c',
};

// Mock data for the uncovered lines table
const uncoveredLinesData = [
  {
    id: 1,
    filePath: './app/components/smartSearchBar/utils.tsx',
    headCoverage: '80%',
    patchCoverage: '80%',
    diffSections: [
      {
        id: 1,
        header: '@@ -1,6 +1,8 @@',
        lines: [
          {
            lineNumber: {old: 41, new: 41},
            code: 'export function escapeTagValue(value: string): string {',
            type: 'unchanged' as const,
          },
          {
            lineNumber: {old: 42, new: 42},
            code: '    // Wrap in quotes if there is a space',
            type: 'unchanged' as const,
          },
          {
            lineNumber: {old: 43, new: 43},
            code: "    const isArrayTag = value.startsWith('[') && value.endsWith(']') && value.includes(',');",
            type: 'added' as const,
          },
          {
            lineNumber: {old: 44, new: 44},
            code: "    return (value.includes(' ') || value.includes('\"')) && !isArrayTag",
            type: 'added' as const,
          },
          {
            lineNumber: {old: 45, new: 45},
            code: '        ? `"${value.replace(/"/g, \'\\"\')}"` ',
            type: 'unchanged' as const,
          },
          {
            lineNumber: {old: 46, new: 46},
            code: '        : value;',
            type: 'unchanged' as const,
          },
          {lineNumber: {old: 47, new: 47}, code: '}', type: 'added' as const},
        ],
      },
    ],
  },
  {
    id: 2,
    filePath: './src/layouts/Header/components/Navigator/Navigator.tsx',
    headCoverage: '100%',
    patchCoverage: '100%',
    diffSections: [
      {
        id: 1,
        header: '@@ -1,6 +1,8 @@',
        lines: [
          {
            lineNumber: {old: 88, new: 93},
            code: 'const MyComponent = ({ showText }) => (',
            type: 'added' as const,
          },
          {
            lineNumber: {old: 89, new: 94},
            code: '    showText ? <p>Hello, world!</p>',
            type: 'added' as const,
          },
          {
            lineNumber: {old: 90, new: 95},
            code: '    ) : null}',
            type: 'unchanged' as const,
          },
        ],
      },
    ],
  },
];

export function CommitDetailSummary() {
  return (
    <Fragment>
      <SummaryContainer columns={12}>
        <SelectedCommitPanel>
          <PanelHeader>{t('Coverage On Selected Commit')}</PanelHeader>
          <PanelBody>
            <SummaryEntries largeColumnSpan={6} smallColumnSpan={2}>
              <SummaryEntry>
                <SummaryEntryLabel
                  showUnderline
                  body={<p>{t('Repository coverage tooltip')}</p>}
                >
                  {t('Repository coverage')}
                </SummaryEntryLabel>
                <SummaryEntryValue>98.98%</SummaryEntryValue>
                <StyledSubText>
                  {t('Head commit')}{' '}
                  <Link to={`/codecov/coverage/commits/${headCommit.sha}`}>
                    {headCommit.shortSha}
                  </Link>
                </StyledSubText>
              </SummaryEntry>
              <SummaryEntry>
                <SummaryEntryLabel
                  showUnderline
                  body={<p>{t('Patch coverage tooltip')}</p>}
                >
                  {t('Patch coverage')}
                </SummaryEntryLabel>
                <SummaryEntryValue>100%</SummaryEntryValue>
              </SummaryEntry>
              <SummaryEntry>
                <SummaryEntryLabel
                  showUnderline
                  body={<p>{t('Uncovered lines tooltip')}</p>}
                >
                  {t('Uncovered lines')}
                </SummaryEntryLabel>
                <SummaryEntryValueLink filterBy="uncoveredLines">5</SummaryEntryValueLink>
              </SummaryEntry>
              <SummaryEntry>
                <SummaryEntryLabel
                  showUnderline
                  body={<p>{t('Files changed tooltip')}</p>}
                >
                  {t('Files changed')}
                </SummaryEntryLabel>
                <SummaryEntryValueLink filterBy="filesChanged">4</SummaryEntryValueLink>
              </SummaryEntry>
              <SummaryEntry>
                <SummaryEntryLabel
                  showUnderline
                  body={<p>{t('Indirect changes tooltip')}</p>}
                >
                  {t('Indirect changes')}
                </SummaryEntryLabel>
                <SummaryEntryValueLink filterBy="indirectChanges">
                  1
                </SummaryEntryValueLink>
              </SummaryEntry>
              <SourceEntry>
                <SummaryEntryLabel showUnderline body={<p>{t('Source tooltip')}</p>}>
                  {t('Source')}
                </SummaryEntryLabel>
                <SourceText>
                  {t('This commit %s compared to', headCommit.shortSha)}{' '}
                  <Link to={`/codecov/coverage/commits/${baseCommit.sha}`}>
                    {baseCommit.shortSha}
                  </Link>
                </SourceText>
              </SourceEntry>
            </SummaryEntries>
          </PanelBody>
        </SelectedCommitPanel>
        <UploadsPanel>
          <PanelHeader>{t('Coverage Uploads - %s', headCommit.shortSha)}</PanelHeader>
          <PanelBody>
            <SummaryEntries largeColumnSpan={1} smallColumnSpan={1}>
              <SummaryEntry>
                <SummaryEntryLabel
                  showUnderline
                  body={<p>{t('Uploads count tooltip')}</p>}
                >
                  {t('Uploads count')}
                </SummaryEntryLabel>
                <SummaryEntryValueLink filterBy="uploadsCount">65</SummaryEntryValueLink>
                <StatusIndicatorContainer>
                  <StatusItem>
                    <StatusDot color="#2BA185" />
                    <StatusText>65 Processed</StatusText>
                  </StatusItem>
                  <StatusItem>
                    <StatusDot color="#EBC000" />
                    <StatusText>15 Pending</StatusText>
                  </StatusItem>
                  <StatusItem>
                    <StatusDot color="#CF2126" />
                    <StatusText>1 Failed</StatusText>
                  </StatusItem>
                </StatusIndicatorContainer>
              </SummaryEntry>
            </SummaryEntries>
          </PanelBody>
        </UploadsPanel>
      </SummaryContainer>
      <UncoveredLinesTable />
    </Fragment>
  );
}

type SortField = 'filePath' | 'headCoverage' | 'patchCoverage';
type SortDirection = 'asc' | 'desc';

function UncoveredLinesTable() {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set([1])); // First row expanded by default
  const [sortField, setSortField] = useState<SortField>('filePath');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const toggleRow = (rowId: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(rowId)) {
      newExpandedRows.delete(rowId);
    } else {
      newExpandedRows.add(rowId);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const allRowIds = uncoveredLinesData.map(item => item.id);
  const allExpanded = allRowIds.every(id => expandedRows.has(id));
  const allCollapsed = allRowIds.every(id => !expandedRows.has(id));

  const handleToggleAll = () => {
    if (allExpanded || (!allExpanded && !allCollapsed)) {
      // If all expanded or mixed state, collapse all
      setExpandedRows(new Set());
    } else {
      // If all collapsed, expand all
      setExpandedRows(new Set(allRowIds));
    }
  };

  const getToggleAllLabel = () => {
    if (allExpanded || (!allExpanded && !allCollapsed)) {
      return t('Collapse All');
    }
    return t('Expand All');
  };

  const sortedData = [...uncoveredLinesData].sort((a, b) => {
    let aValue: string;
    let bValue: string;

    switch (sortField) {
      case 'filePath':
        aValue = a.filePath;
        bValue = b.filePath;
        break;
      case 'headCoverage':
        aValue = a.headCoverage;
        bValue = b.headCoverage;
        break;
      case 'patchCoverage':
        aValue = a.patchCoverage;
        bValue = b.patchCoverage;
        break;
      default:
        aValue = a.filePath;
        bValue = b.filePath;
        break;
    }

    // For percentage values, extract numeric part for proper sorting
    if (sortField === 'headCoverage' || sortField === 'patchCoverage') {
      const aNum = parseInt(aValue.replace('%', ''), 10);
      const bNum = parseInt(bValue.replace('%', ''), 10);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }

    // For string values (filePath)
    const comparison = aValue.localeCompare(bValue);
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <div>
      <TableTitle>{t('Uncovered lines (6)')}</TableTitle>
      <UncoveredLinesPanel>
        <TableContainer>
          <TableHeaderRow>
            <SortableFilePathHeader
              onClick={() => handleSort('filePath')}
              isActive={sortField === 'filePath'}
            >
              <ToggleAllButton
                onClick={e => {
                  e.stopPropagation();
                  handleToggleAll();
                }}
              >
                {getToggleAllLabel()}
              </ToggleAllButton>
              <FilePathLabel>
                {t('File path')}
                {sortField === 'filePath' && (
                  <IconArrow
                    direction={sortDirection === 'asc' ? 'up' : 'down'}
                    size="xs"
                    style={{opacity: 0.6}}
                  />
                )}
              </FilePathLabel>
            </SortableFilePathHeader>
            <SortableCoverageHeader
              onClick={() => handleSort('headCoverage')}
              isActive={sortField === 'headCoverage'}
            >
              {t('HEAD %')}
              <IconArrow
                direction={
                  sortField === 'headCoverage'
                    ? sortDirection === 'asc'
                      ? 'up'
                      : 'down'
                    : 'down'
                }
                size="xs"
                style={{opacity: sortField === 'headCoverage' ? 0.8 : 0.6}}
              />
            </SortableCoverageHeader>
            <SortableCoverageHeader
              onClick={() => handleSort('patchCoverage')}
              isActive={sortField === 'patchCoverage'}
            >
              {t('patch %')}
              {sortField === 'patchCoverage' && (
                <IconArrow
                  direction={sortDirection === 'asc' ? 'up' : 'down'}
                  size="xs"
                  style={{opacity: 0.6}}
                />
              )}
            </SortableCoverageHeader>
          </TableHeaderRow>

          {sortedData.map(fileData => (
            <Fragment key={fileData.id}>
              <TableRow>
                <FilePathCell onClick={() => toggleRow(fileData.id)}>
                  <ChevronIcon
                    isExpanded={expandedRows.has(fileData.id)}
                    direction={expandedRows.has(fileData.id) ? 'down' : 'right'}
                    size="sm"
                  />
                  <FilePath>{fileData.filePath}</FilePath>
                </FilePathCell>
                <CoverageCell>{fileData.headCoverage}</CoverageCell>
                <CoverageCell>{fileData.patchCoverage}</CoverageCell>
              </TableRow>

              {expandedRows.has(fileData.id) && (
                <ExpandedRow>
                  <ExpandedContent>
                    {fileData.diffSections.map(section => (
                      <DiffSection key={section.id}>
                        <DiffHeader>
                          <DiffHeaderText>{section.header}</DiffHeaderText>
                          <DiffHeaderActions>
                            <IconGithub size="xs" />
                            <IconOpen size="xs" />
                          </DiffHeaderActions>
                        </DiffHeader>
                        <CodeBlock>
                          {section.lines.map((line, index) => (
                            <CodeLine key={index} lineType={line.type}>
                              <LineNumber lineType={line.type}>
                                {line.lineNumber.old}
                              </LineNumber>
                              <LineNumber lineType={line.type}>
                                {line.lineNumber.new}
                              </LineNumber>
                              <CodeContent>
                                <CodeText lineType={line.type}>{line.code}</CodeText>
                              </CodeContent>
                            </CodeLine>
                          ))}
                        </CodeBlock>
                      </DiffSection>
                    ))}
                  </ExpandedContent>
                </ExpandedRow>
              )}
            </Fragment>
          ))}
        </TableContainer>
      </UncoveredLinesPanel>
    </div>
  );
}

const StatusIndicatorContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const StatusItem = styled('div')`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const StatusDot = styled('div')<{color: string}>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${p => p.color};
  flex-shrink: 0;
`;

const StatusText = styled('span')`
  font-family: Rubik, ${p => p.theme.text.family};
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: #71637e;
`;

const StyledSubText = styled('p')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.gray300};
`;

const SourceText = styled('p')`
  font-size: ${p => p.theme.fontSize.sm};
`;

const SourceEntry = styled(SummaryEntry)`
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 85%;
`;

const SelectedCommitPanel = styled(Panel)`
  grid-column: span 12;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-column: span 9;
  }
`;

const UploadsPanel = styled(Panel)`
  grid-column: span 12;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-column: span 3;
  }
`;

const UncoveredLinesPanel = styled('div')`
  margin-top: ${space(3)};
  border: 1px solid #e0dce5;
  border-radius: 10px;
  background: #ffffff;
  overflow: hidden;
`;

const TableTitle = styled('h3')`
  margin: 0 0 ${space(2)} 0;
  font-family: Rubik, ${p => p.theme.text.family};
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.64%;
  color: #2b2233;
`;

const TableContainer = styled('div')`
  overflow: hidden;
`;

const TableHeaderRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 132px 102px;
  background: #faf9fb;
  border-bottom: 1px solid #e0dce5;
`;

const SortableFilePathHeader = styled('div')<{isActive: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  font-family: Rubik, ${p => p.theme.text.family};
  font-size: 12px;
  font-weight: 500;
  line-height: 1em;
  text-transform: uppercase;
  color: ${p => (p.isActive ? '#2b2233' : '#80708f')};
  border-right: 1px solid #e0dce5;
  cursor: pointer;
  user-select: none;
  transition: color 0.15s ease;

  &:hover {
    color: #2b2233;
  }
`;

const ToggleAllButton = styled('button')`
  display: flex;
  align-items: center;
  background: none;
  border: 1px solid #e0dce5;
  border-radius: 4px;
  padding: 4px 8px;
  font-family: Rubik, ${p => p.theme.text.family};
  font-size: 11px;
  font-weight: 500;
  color: #71637e;
  cursor: pointer;
  transition: all 0.15s ease;
  text-transform: capitalize;

  &:hover {
    background: #faf9fb;
    color: #2b2233;
    border-color: #71637e;
  }

  &:active {
    background: #f0ecf3;
  }
`;

const FilePathLabel = styled('div')`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const SortableCoverageHeader = styled('div')<{isActive: boolean}>`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 12px 16px;
  font-family: Rubik, ${p => p.theme.text.family};
  font-size: 12px;
  font-weight: 500;
  line-height: 1em;
  text-transform: uppercase;
  color: ${p => (p.isActive ? '#2b2233' : '#71637e')};
  border-right: 1px solid #e0dce5;
  cursor: pointer;
  user-select: none;
  transition: color 0.15s ease;

  &:hover {
    color: #2b2233;
  }

  &:last-child {
    border-right: none;
  }
`;

const TableRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 132px 102px;
  background: #ffffff;
  border-bottom: 1px solid #e0dce5;

  &:hover {
    background: #faf9fb;
  }
`;

const FilePathCell = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  border-right: 1px solid #e0dce5;
  background: #ffffff;
`;

const ChevronIcon = styled(IconChevron)<{isExpanded: boolean}>`
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  transition: transform 0.15s ease;
  transform: rotate(${p => (p.isExpanded ? '0deg' : '-90deg')});
  color: #2b2233;
`;

const FilePath = styled('span')`
  font-family: Rubik, ${p => p.theme.text.family};
  font-size: 14px;
  font-weight: 400;
  line-height: 1.4;
  color: #3e3446;
  flex: 1;
  word-break: break-all;
`;

const CoverageCell = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 16px;
  font-family: Rubik, ${p => p.theme.text.family};
  font-size: 14px;
  font-weight: 400;
  line-height: 1.4;
  color: #2b2233;
  background: #ffffff;
  border-right: 1px solid #e0dce5;

  &:last-child {
    border-right: none;
  }
`;

const ExpandedRow = styled('div')`
  grid-column: 1 / -1;
  background: #f0ecf3;
  border-bottom: 1px solid #e0dce5;

  &:last-child {
    border-bottom: none;
    border-radius: 0 0 10px 10px;
  }
`;

const ExpandedContent = styled('div')`
  padding: 15px;
`;

const DiffSection = styled('div')`
  background: #ffffff;
  border: 1px solid #e0dce5;
  border-radius: 0;
  margin-bottom: ${space(2)};
  overflow: hidden;

  &:last-child {
    margin-bottom: 0;
  }
`;

const DiffHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #faf9fb;
  border-bottom: 1px solid rgba(45, 0, 85, 0.06);
`;

const DiffHeaderText = styled('span')`
  font-family: 'Roboto Mono', ${p => p.theme.text.familyMono};
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: #3e3446;
`;

const DiffHeaderActions = styled('div')`
  display: flex;
  align-items: center;
  gap: 12px;

  svg {
    width: 12px;
    height: 12px;
    color: #71637e;
    opacity: 0.6;
    cursor: pointer;

    &:hover {
      opacity: 1;
    }
  }
`;

const CodeBlock = styled('div')`
  font-family: 'Roboto Mono', ${p => p.theme.text.familyMono};
  font-size: 13px;
  background: #ffffff;
`;

const CodeLine = styled('div')<{lineType: 'unchanged' | 'added' | 'removed'}>`
  display: flex;
  align-items: stretch;
  background: ${p => {
    switch (p.lineType) {
      case 'added':
        return 'rgba(43, 161, 133, 0.11)';
      case 'removed':
        return 'rgba(245, 84, 89, 0.1)';
      default:
        return '#FFFFFF';
    }
  }};
`;

const LineNumber = styled('div')<{lineType: 'unchanged' | 'added' | 'removed'}>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: auto;
  min-width: 40px;
  padding: 0;
  text-align: right;
  color: #3e3446;
  background: ${p => {
    switch (p.lineType) {
      case 'added':
        return 'rgba(43, 161, 133, 0.11)';
      case 'removed':
        return 'rgba(245, 84, 89, 0.1)';
      default:
        return 'rgba(245, 84, 89, 0.1)';
    }
  }};
  border-right: ${p => {
    switch (p.lineType) {
      case 'added':
        return '2px solid #2BA185';
      case 'removed':
        return '2px solid #F55459';
      default:
        return '2px solid #F55459';
    }
  }};
  font-family: 'Roboto Mono', ${p => p.theme.text.familyMono};
  font-size: 13px;
  font-weight: 400;
  line-height: 2;
`;

const CodeContent = styled('div')`
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 0 12px;
  flex: 1;
`;

const CodeText = styled('span')<{lineType?: 'unchanged' | 'added' | 'removed'}>`
  font-family: 'Roboto Mono', ${p => p.theme.text.familyMono};
  font-size: 13px;
  font-weight: ${p => (p.lineType === 'added' ? '425' : '400')};
  line-height: 2;
  color: #3e3446;
  flex: 1;
`;
