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
                    <StatusDot $variant="success" />
                    <StatusText>65 Processed</StatusText>
                  </StatusItem>
                  <StatusItem>
                    <StatusDot $variant="warning" />
                    <StatusText>15 Pending</StatusText>
                  </StatusItem>
                  <StatusItem>
                    <StatusDot $variant="error" />
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

const StatusDot = styled('div')<{$variant: 'success' | 'warning' | 'error'}>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${p => {
    switch (p.$variant) {
      case 'success':
        return p.theme.green300;
      case 'warning':
        return p.theme.yellow300;
      case 'error':
        return p.theme.red300;
      default:
        return p.theme.gray300;
    }
  }};
  flex-shrink: 0;
`;

const StatusText = styled('span')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
  line-height: 1.2;
  color: ${p => p.theme.subText};
`;

const StyledSubText = styled('p')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
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
  margin-top: ${p => p.theme.space['2xl']};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background};
  overflow: hidden;
`;

const TableTitle = styled('h3')`
  margin: 0 0 ${p => p.theme.space.xl} 0;
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: ${p => p.theme.text.lineHeightHeading};
  letter-spacing: -0.64%;
  color: ${p => p.theme.headingColor};
`;

const TableContainer = styled('div')`
  overflow: hidden;
`;

const TableHeaderRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 132px 102px;
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const SortableFilePathHeader = styled('div')<{isActive: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 500;
  line-height: 1em;
  text-transform: uppercase;
  color: ${p => (p.isActive ? p.theme.headingColor : p.theme.subText)};
  border-right: 1px solid ${p => p.theme.border};
  cursor: pointer;
  user-select: none;
  transition: color 0.15s ease;

  &:hover {
    color: ${p => p.theme.headingColor};
  }
`;

const ToggleAllButton = styled('button')`
  display: flex;
  align-items: center;
  background: none;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: 500;
  color: ${p => p.theme.subText};
  cursor: pointer;
  transition: all 0.15s ease;
  text-transform: capitalize;

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
    color: ${p => p.theme.headingColor};
    border-color: ${p => p.theme.subText};
  }

  &:active {
    background: ${p => p.theme.backgroundTertiary};
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
  gap: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 500;
  line-height: 1em;
  text-transform: uppercase;
  color: ${p => (p.isActive ? p.theme.headingColor : p.theme.subText)};
  border-right: 1px solid ${p => p.theme.border};
  cursor: pointer;
  user-select: none;
  transition: color 0.15s ease;

  &:hover {
    color: ${p => p.theme.headingColor};
  }

  &:last-child {
    border-right: none;
  }
`;

const TableRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 132px 102px;
  background: ${p => p.theme.background};
  border-bottom: 1px solid ${p => p.theme.border};

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const FilePathCell = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  cursor: pointer;
  border-right: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
`;

const ChevronIcon = styled(IconChevron)<{isExpanded: boolean}>`
  flex-shrink: 0;
  width: ${p => p.theme.space.xl};
  height: ${p => p.theme.space.xl};
  transition: transform 0.15s ease;
  transform: rotate(${p => (p.isExpanded ? '0deg' : '-90deg')});
  color: ${p => p.theme.headingColor};
`;

const FilePath = styled('span')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.textColor};
  flex: 1;
  word-break: break-all;
`;

const CoverageCell = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.headingColor};
  background: ${p => p.theme.background};
  border-right: 1px solid ${p => p.theme.border};

  &:last-child {
    border-right: none;
  }
`;

const ExpandedRow = styled('div')`
  grid-column: 1 / -1;
  background: ${p => p.theme.backgroundTertiary};
  border-bottom: 1px solid ${p => p.theme.border};

  &:last-child {
    border-bottom: none;
    border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  }
`;

const ExpandedContent = styled('div')`
  padding: ${p => p.theme.space.lg};
`;

const DiffSection = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 0;
  margin-bottom: ${p => p.theme.space.xl};
  overflow: hidden;

  &:last-child {
    margin-bottom: 0;
  }
`;

const DiffHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const DiffHeaderText = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.textColor};
`;

const DiffHeaderActions = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.lg};

  svg {
    width: ${p => p.theme.fontSize.sm};
    height: ${p => p.theme.fontSize.sm};
    color: ${p => p.theme.subText};
    opacity: 0.6;
    cursor: pointer;

    &:hover {
      opacity: 1;
    }
  }
`;

const CodeBlock = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  background: ${p => p.theme.background};
`;

const CodeLine = styled('div')<{lineType: 'unchanged' | 'added' | 'removed'}>`
  display: flex;
  align-items: stretch;
  background: ${p => {
    switch (p.lineType) {
      case 'added':
        return p.theme.green100;
      case 'removed':
        return p.theme.red100;
      default:
        return p.theme.background;
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
  color: ${p => p.theme.textColor};
  background: ${p => {
    switch (p.lineType) {
      case 'added':
        return p.theme.green100;
      case 'removed':
        return p.theme.red100;
      default:
        return p.theme.red100;
    }
  }};
  border-right: ${p => {
    switch (p.lineType) {
      case 'added':
        return `2px solid ${p.theme.green300}`;
      case 'removed':
        return `2px solid ${p.theme.red300}`;
      default:
        return `2px solid ${p.theme.red300}`;
    }
  }};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  font-weight: ${p => p.theme.fontWeight.normal};
  line-height: 2;
`;

const CodeContent = styled('div')`
  display: flex;
  align-items: stretch;
  gap: ${p => p.theme.space.md};
  padding: 0 ${p => p.theme.space.lg};
  flex: 1;
`;

const CodeText = styled('span')<{lineType?: 'unchanged' | 'added' | 'removed'}>`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  font-weight: ${p => (p.lineType === 'added' ? '425' : p.theme.fontWeight.normal)};
  line-height: 2;
  color: ${p => p.theme.textColor};
  flex: 1;
`;
