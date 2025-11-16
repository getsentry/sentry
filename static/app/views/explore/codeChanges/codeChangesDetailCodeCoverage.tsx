import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {Heading, Text} from 'sentry/components/core/text';
import {IconArrow, IconChevron, IconGithub, IconIssues, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {SummaryCard, SummaryCardGroup} from 'sentry/views/prevent/summary';

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
    uncoveredLines: 4,
    diffSections: [
      {
        id: 1,
        header: '@@ -1,6 +1,8 @@',
        lines: [
          {
            lineNumber: {old: 41, new: 41},
            code: 'export function escapeTagValue(value: string): string {',
            type: 'covered' as const,
            coverage: 'covered' as const,
          },
          {
            lineNumber: {old: 42, new: 42},
            code: '    // Wrap in quotes if there is a space',
            type: 'covered' as const,
            coverage: 'covered' as const,
          },
          {
            lineNumber: {old: 43, new: 43},
            code: "    const isArrayTag = value.startsWith('[') && value.endsWith(']') && value.includes(',');",
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 44, new: 44},
            code: "    return (value.includes(' ') || value.includes('\"')) && !isArrayTag",
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 45, new: 45},
            code: '        ? `"${value.replace(/"/g, \'\\"\')}"` ',
            type: 'partially-covered' as const,
            coverage: 'partially-covered' as const,
          },
          {
            lineNumber: {old: 46, new: 46},
            code: '        : value;',
            type: 'covered' as const,
            coverage: 'covered' as const,
          },
          {
            lineNumber: {old: 47, new: 47},
            code: '}',
            type: 'covered' as const,
            coverage: 'covered' as const,
          },
        ],
      },
    ],
  },
  {
    id: 2,
    filePath: './src/layouts/Header/components/Navigator/Navigator.tsx',
    headCoverage: '100%',
    patchCoverage: '100%',
    uncoveredLines: 1,
    diffSections: [
      {
        id: 1,
        header: '@@ -1,6 +1,8 @@',
        lines: [
          {
            lineNumber: {old: 88, new: 93},
            code: 'const MyComponent = ({ showText }) => (',
            type: 'partially-covered' as const,
            coverage: 'partially-covered' as const,
          },
          {
            lineNumber: {old: 89, new: 94},
            code: '    showText ? <p>Hello, world!</p>',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 90, new: 95},
            code: '    ) : null}',
            type: 'covered' as const,
            coverage: 'covered' as const,
          },
        ],
      },
    ],
  },
];

type CoverageType = 'covered' | 'uncovered' | 'partially-covered';

type LineData = {
  code: string;
  coverage: CoverageType;
  lineNumber: {new: number; old: number};
  type: CoverageType;
};

type DiffSection = {
  header: string;
  id: number;
  lines: LineData[];
};

function CoverageLegend() {
  return (
    <InlineLegendContainer>
      <InlineLegendTitle>{t('Coverage Legend')}</InlineLegendTitle>
      <LegendItems>
        <LegendItem>
          <LegendColorBox $color="green" />
          <LegendLabel>{t('Covered')}</LegendLabel>
        </LegendItem>
        <LegendItem>
          <LegendColorBox $color="orange" />
          <LegendLabel>{t('Partial')}</LegendLabel>
        </LegendItem>
        <LegendItem>
          <LegendColorBox $color="red" />
          <LegendLabel>{t('Uncovered')}</LegendLabel>
        </LegendItem>
      </LegendItems>
    </InlineLegendContainer>
  );
}

type SortField = 'filePath' | 'headCoverage' | 'patchCoverage' | 'uncoveredLines';
type SortDirection = 'asc' | 'desc';

function UncoveredLinesTable() {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set([1])); // First row expanded by default
  const [sortField, setSortField] = useState<SortField>('uncoveredLines');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
      case 'uncoveredLines':
        aValue = a.uncoveredLines.toString();
        bValue = b.uncoveredLines.toString();
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

    // For uncovered lines, compare numeric values
    if (sortField === 'uncoveredLines') {
      const aNum = parseInt(aValue, 10);
      const bNum = parseInt(bValue, 10);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }

    // For string values (filePath)
    const comparison = aValue.localeCompare(bValue);
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <div>
      <TableTitleContainer>
        <Heading as="h3">{t('View all the file changes')}</Heading>
        <CoverageLegend />
      </TableTitleContainer>
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
                <SortIcon
                  $isActive={sortField === 'filePath'}
                  direction={sortDirection === 'asc' ? 'up' : 'down'}
                  size="xs"
                />
              </FilePathLabel>
            </SortableFilePathHeader>
            <SortableCoverageHeader
              onClick={() => handleSort('uncoveredLines')}
              isActive={sortField === 'uncoveredLines'}
            >
              {t('Uncovered lines')}
              <SortIcon
                $isActive={sortField === 'uncoveredLines'}
                direction={sortDirection === 'asc' ? 'up' : 'down'}
                size="xs"
              />
            </SortableCoverageHeader>
            <SortableCoverageHeader
              onClick={() => handleSort('headCoverage')}
              isActive={sortField === 'headCoverage'}
            >
              {t('HEAD %')}
              <SortIcon
                $isActive={sortField === 'headCoverage'}
                direction={sortDirection === 'asc' ? 'up' : 'down'}
                size="xs"
              />
            </SortableCoverageHeader>
            <SortableCoverageHeader
              onClick={() => handleSort('patchCoverage')}
              isActive={sortField === 'patchCoverage'}
            >
              {t('patch %')}
              <SortIcon
                $isActive={sortField === 'patchCoverage'}
                direction={sortDirection === 'asc' ? 'up' : 'down'}
                size="xs"
              />
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
                <CoverageCell>{fileData.uncoveredLines}</CoverageCell>
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
                          {section.lines.map((line, index) => {
                            const coverageType = line.coverage || 'uncovered';
                            return (
                              <CodeLine key={index} lineType={coverageType}>
                                <LineNumber lineType={coverageType}>
                                  {line.lineNumber.old}
                                </LineNumber>
                                <LineNumber lineType={coverageType}>
                                  {line.lineNumber.new}
                                </LineNumber>
                                <CodeContent>
                                  <CodeText lineType={coverageType}>{line.code}</CodeText>
                                </CodeContent>
                              </CodeLine>
                            );
                          })}
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

export function CodeCoverageView({
  CommitLink,
}: {
  CommitLink: React.ComponentType<{children: React.ReactNode; commitSha: string}>;
}) {
  return (
    <Fragment>
      <SummaryCardGroup
        title={t('Coverage On Selected Pull Request')}
        isLoading={false}
        placeholderCount={5}
        trailingHeaderItems={
          <Text size="sm" variant="muted">
            {t('Source: The change% is based on head')}{' '}
            <CommitLink commitSha={headCommit.sha}>10d8629(2 uploads)</CommitLink>{' '}
            {t('compared to base')}{' '}
            <CommitLink commitSha={baseCommit.sha}>3d59704(1 uploads)</CommitLink>
          </Text>
        }
      >
        <Fragment>
          <RepositoryCoverageCard>
            <SummaryCard
              label={t('Repository coverage')}
              tooltip={
                <p>
                  {t(
                    'The percentage of lines covered by tests across the entire repository.'
                  )}
                  <hr />
                  {t('Head commit: %s', headCommit.shortSha)}
                </p>
              }
              value="97.83%"
              extra={<Tag type="success">+4.25%</Tag>}
            />
          </RepositoryCoverageCard>
          <SummaryCard
            label={t('Patch coverage')}
            tooltip={
              <p>
                {t(
                  'The test coverage for lines changed in a pull request or commit, ensuring new code is tested before merging.'
                )}
              </p>
            }
            value="87.50%"
            extra={
              <Button
                size="xs"
                icon={<IconIssues />}
                title={t('Go to Issues to add missing tests')}
                aria-label={t('Go to Issues to add missing tests')}
              >
                3
              </Button>
            }
          />
          <SummaryCard
            label={t('Files changed')}
            tooltip={
              <p>
                {t(
                  'Files that were directly modified in a pull request or commit—these are the files where actual code changes were made.'
                )}
              </p>
            }
            value={2}
            filterBy="filesChanged"
          />
          <SummaryCard
            label={t('Indirect changes')}
            tooltip={
              <p>
                {t(
                  'Changes that originated from other files in the same commit—these files did not have changes in this PR.'
                )}
                <ExternalLink
                  href="https://docs.codecov.com/docs/coverage-on-indirect-changes"
                  style={{marginLeft: '4px'}}
                >
                  {t('View list of indirect changes.')}
                </ExternalLink>
              </p>
            }
            value={0}
            filterBy="indirectChanges"
          />
        </Fragment>
      </SummaryCardGroup>
      <UncoveredLinesTable />
    </Fragment>
  );
}

const RepositoryCoverageCard = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;
`;

const UncoveredLinesPanel = styled('div')`
  margin-top: ${p => p.theme.space.xl};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background};
  overflow: hidden;
`;

const TableContainer = styled('div')`
  overflow: hidden;
`;

const TableHeaderRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 132px 132px 102px;
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
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
`;

const SortableCoverageHeader = styled('div')<{isActive: boolean}>`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
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

const SortIcon = styled(IconArrow)<{$isActive: boolean}>`
  opacity: ${p => (p.$isActive ? 0.8 : 0)};
  transition: opacity 0.15s ease;

  ${SortableCoverageHeader}:hover &,
  ${SortableFilePathHeader}:hover & {
    opacity: 0.8;
  }
`;

const TableRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 132px 132px 102px;
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
  transform: rotate(${p => (p.isExpanded ? '0deg' : '90deg')});
  color: ${p => p.theme.headingColor};
`;

const FilePath = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
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

const CodeLine = styled('div')<{lineType: CoverageType}>`
  display: flex;
  align-items: stretch;
  background: ${p => {
    switch (p.lineType) {
      case 'covered':
        return p.theme.green100;
      case 'uncovered':
        return p.theme.red100;
      case 'partially-covered':
        return p.theme.yellow100;
      default:
        return p.theme.background;
    }
  }};
`;

const LineNumber = styled('div')<{lineType: CoverageType}>`
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
      case 'covered':
        return p.theme.green100;
      case 'uncovered':
        return p.theme.red100;
      case 'partially-covered':
        return p.theme.yellow100;
      default:
        return p.theme.background;
    }
  }};
  border-right: ${p => {
    switch (p.lineType) {
      case 'covered':
        return `2px solid ${p.theme.green300}`;
      case 'uncovered':
        return `2px solid ${p.theme.red300}`;
      case 'partially-covered':
        return `2px solid ${p.theme.yellow300}`;
      default:
        return `2px solid ${p.theme.border}`;
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

const CodeText = styled('span')<{lineType?: CoverageType}>`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  font-weight: ${p => (p.lineType === 'uncovered' ? '425' : p.theme.fontWeight.normal)};
  line-height: 2;
  color: ${p => p.theme.textColor};
  flex: 1;
`;

const TableTitleContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: ${p => p.theme.space.xl};
  margin-bottom: ${p => p.theme.space.xl};
  gap: ${p => p.theme.space.lg};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: flex-start;
    gap: ${p => p.theme.space.md};
  }
`;

const InlineLegendContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
`;

const InlineLegendTitle = styled('span')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.subText};
  white-space: nowrap;
`;

const LegendItems = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  flex-wrap: wrap;
`;

const LegendItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const LegendColorBox = styled('div')<{$color: 'green' | 'orange' | 'red'}>`
  width: 16px;
  height: 16px;
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => {
    switch (p.$color) {
      case 'green':
        return p.theme.green100;
      case 'orange':
        return p.theme.yellow100;
      case 'red':
        return p.theme.red100;
      default:
        return p.theme.background;
    }
  }};
  border: ${p => {
    switch (p.$color) {
      case 'green':
        return `1px solid ${p.theme.green300}`;
      case 'orange':
        return `1px solid ${p.theme.yellow300}`;
      case 'red':
        return `1px solid ${p.theme.red300}`;
      default:
        return `1px solid ${p.theme.border}`;
    }
  }};
`;

const LegendLabel = styled('span')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.textColor};
`;
