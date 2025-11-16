import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {IconChevron, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';

// Mock data for files changed
const filesChangedData = [
  {
    id: 1,
    fileName: './app/components/smartSearchBar/utils.tsx',
    additions: 3,
    deletions: 2,
    status: 'modified' as const,
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
            type: 'unchanged' as const,
          },
          {
            lineNumber: {old: 44, new: null},
            code: "    return (value.includes(' ') || value.includes('\"')) && !isArrayTag",
            type: 'removed' as const,
          },
          {
            lineNumber: {old: 45, new: null},
            code: '        ? `"${value.replace(/"/g, \'\\"\')}"` ',
            type: 'removed' as const,
          },
          {
            lineNumber: {old: null, new: 44},
            code: "    return (value.includes(' ') || value.includes('\"')) && !isArrayTag",
            type: 'added' as const,
          },
          {
            lineNumber: {old: null, new: 45},
            code: '        ? `"${value.replace(/"/g, \'\\\\"\')}"` ',
            type: 'added' as const,
          },
          {
            lineNumber: {old: null, new: 46},
            code: '        : value.trim();',
            type: 'added' as const,
          },
          {
            lineNumber: {old: 46, new: 47},
            code: '}',
            type: 'unchanged' as const,
          },
        ],
      },
    ],
  },
  {
    id: 2,
    fileName: './src/layouts/Header/components/Navigator/Navigator.tsx',
    additions: 1,
    deletions: 1,
    status: 'modified' as const,
    diffSections: [
      {
        id: 1,
        header: '@@ -1,6 +1,8 @@',
        lines: [
          {
            lineNumber: {old: 88, new: 88},
            code: 'const MyComponent = ({ showText }) => (',
            type: 'unchanged' as const,
          },
          {
            lineNumber: {old: 89, new: null},
            code: '    showText ? <p>Hello, world!</p>',
            type: 'removed' as const,
          },
          {
            lineNumber: {old: null, new: 89},
            code: '    showText ? <p>Hello, React!</p>',
            type: 'added' as const,
          },
          {
            lineNumber: {old: 90, new: 90},
            code: '    ) : null}',
            type: 'unchanged' as const,
          },
        ],
      },
    ],
  },
];

type DiffLineType = 'added' | 'removed' | 'unchanged';

type _FileDiffLine = {
  code: string;
  lineNumber: {new: number | null; old: number | null};
  type: DiffLineType;
};

export function FilesChangedView() {
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set([1]));

  const toggleFile = (fileId: number) => {
    const newExpandedFiles = new Set(expandedFiles);
    if (newExpandedFiles.has(fileId)) {
      newExpandedFiles.delete(fileId);
    } else {
      newExpandedFiles.add(fileId);
    }
    setExpandedFiles(newExpandedFiles);
  };

  const totalAdditions = filesChangedData.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = filesChangedData.reduce((sum, file) => sum + file.deletions, 0);

  const allFileIds = filesChangedData.map(file => file.id);
  const allExpanded = allFileIds.every(id => expandedFiles.has(id));
  const allCollapsed = allFileIds.every(id => !expandedFiles.has(id));

  const handleToggleAll = () => {
    if (allExpanded || (!allExpanded && !allCollapsed)) {
      // If all expanded or mixed state, collapse all
      setExpandedFiles(new Set());
    } else {
      // If all collapsed, expand all
      setExpandedFiles(new Set(allFileIds));
    }
  };

  const getToggleAllLabel = () => {
    if (allExpanded || (!allExpanded && !allCollapsed)) {
      return t('Collapse All');
    }
    return t('Expand All');
  };

  return (
    <Fragment>
      <PRSummaryContainer>
        <PRSummaryHeader>
          <IconSeer size="md" />
          <PRSummaryTitle>{t('PR Summary by Seer AI')}</PRSummaryTitle>
        </PRSummaryHeader>
        <PRSummaryContent>
          <SummaryText>
            This pull request fixes an issue with escaping double quotes in tag values.
            The main change is in the <CodeSnippet>escapeTagValue</CodeSnippet> function
            where the escape sequence for quotes was corrected from{' '}
            <CodeSnippet>\'\"</CodeSnippet> to <CodeSnippet>\\"</CodeSnippet>. This
            ensures that double quotes are properly escaped when wrapping tag values that
            contain spaces or quotes. Additionally, the function now explicitly trims the
            value before returning it.
          </SummaryText>
        </PRSummaryContent>
        <PRSummaryFooter>
          <FooterText>
            {t('Generated by Seer AI • This summary may not be fully accurate')}
          </FooterText>
        </PRSummaryFooter>
      </PRSummaryContainer>

      <FilesChangedContainer>
        <FilesChangedHeader>
          <FilesChangedHeaderLeft>
            <FilesCountBadge>
              {t('Files')} ({filesChangedData.length})
            </FilesCountBadge>
            <DiffStats>
              <AdditionsCount>+{totalAdditions}</AdditionsCount>
              <DeletionsCount>-{totalDeletions}</DeletionsCount>
            </DiffStats>
          </FilesChangedHeaderLeft>
          <ToggleAllFilesButton onClick={handleToggleAll}>
            {getToggleAllLabel()}
          </ToggleAllFilesButton>
        </FilesChangedHeader>

        {filesChangedData.map(file => (
          <FileChangeItem key={file.id}>
            <FileHeader onClick={() => toggleFile(file.id)}>
              <FileHeaderLeft>
                <ChevronIcon
                  isExpanded={expandedFiles.has(file.id)}
                  direction={expandedFiles.has(file.id) ? 'down' : 'right'}
                  size="sm"
                />
                <FileName>{file.fileName}</FileName>
              </FileHeaderLeft>
              <FileHeaderRight>
                <FileDiffStats>
                  <FileAdditionsCount>+{file.additions}</FileAdditionsCount>
                  <FileDeletionsCount>-{file.deletions}</FileDeletionsCount>
                </FileDiffStats>
                <FileStatusBadge status={file.status}>
                  {file.status === 'modified'
                    ? t('modified')
                    : file.status === 'added'
                      ? t('added')
                      : t('removed')}
                </FileStatusBadge>
              </FileHeaderRight>
            </FileHeader>

            {expandedFiles.has(file.id) && (
              <FileDiffContainer>
                {file.diffSections.map(section => (
                  <DiffSectionContainer key={section.id}>
                    <DiffSectionHeader>{section.header}</DiffSectionHeader>
                    <DiffLinesContainer>
                      {section.lines.map((line, index) => (
                        <DiffLine key={index} lineType={line.type}>
                          <DiffLineNumber lineType={line.type}>
                            {line.lineNumber.old || ''}
                          </DiffLineNumber>
                          <DiffLineNumber lineType={line.type}>
                            {line.lineNumber.new || ''}
                          </DiffLineNumber>
                          <DiffLineCode lineType={line.type}>
                            {line.type === 'added' && <DiffPrefix>+</DiffPrefix>}
                            {line.type === 'removed' && <DiffPrefix>-</DiffPrefix>}
                            {line.type === 'unchanged' && <DiffPrefix> </DiffPrefix>}
                            {line.code}
                          </DiffLineCode>
                        </DiffLine>
                      ))}
                    </DiffLinesContainer>
                  </DiffSectionContainer>
                ))}
              </FileDiffContainer>
            )}
          </FileChangeItem>
        ))}
      </FilesChangedContainer>
    </Fragment>
  );
}

// PR Summary Styles
const PRSummaryContainer = styled('div')`
  margin-top: ${p => p.theme.space.xl};
  margin-bottom: ${p => p.theme.space.xl};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
`;

const PRSummaryHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  background: linear-gradient(
    135deg,
    ${p => p.theme.white} 0%,
    ${p => p.theme.white} 100%
  );
  border-bottom: 1px solid ${p => p.theme.border};
`;

const PRSummaryTitle = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.headingColor};
  flex: 1;
`;

const PRSummaryContent = styled('div')`
  padding: ${p => p.theme.space.lg};
  background: ${p => p.theme.background};
`;

const SummaryText = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.6;
  color: ${p => p.theme.textColor};
`;

const CodeSnippet = styled('code')`
  padding: 2px 6px;
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  color: ${p => p.theme.purple400};
  white-space: nowrap;
`;

const PRSummaryFooter = styled('div')`
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.lg};
  background: ${p => p.theme.white};
  border-top: 1px solid ${p => p.theme.border};
`;

const FooterText = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.subText};
  font-style: italic;
`;

// Files Changed Styles
const FilesChangedContainer = styled('div')`
  margin-top: ${p => p.theme.space.xl};
`;

const FilesChangedHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const FilesChangedHeaderLeft = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
`;

const FilesCountBadge = styled('span')`
  color: ${p => p.theme.headingColor};
`;

const ToggleAllFilesButton = styled('button')`
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

const DiffStats = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const AdditionsCount = styled('span')`
  color: ${p => p.theme.green300};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const DeletionsCount = styled('span')`
  color: ${p => p.theme.red300};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const FileChangeItem = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-top: none;
  background: ${p => p.theme.background};

  &:last-child {
    border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  }
`;

const FileHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const FileHeaderLeft = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  flex: 1;
`;

const FileName = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.textColor};
`;

const FileHeaderRight = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.lg};
`;

const FileDiffStats = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  font-size: ${p => p.theme.fontSize.sm};
  font-family: ${p => p.theme.text.familyMono};
`;

const FileAdditionsCount = styled('span')`
  color: ${p => p.theme.green300};
`;

const FileDeletionsCount = styled('span')`
  color: ${p => p.theme.red300};
`;

const FileStatusBadge = styled('span')<{status: 'modified' | 'added' | 'removed'}>`
  padding: 2px ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.borderRadius};
  font-size: 10px;
  font-weight: ${p => p.theme.fontWeight.normal};
  background: ${p => {
    switch (p.status) {
      case 'modified':
        return p.theme.yellow100;
      case 'added':
        return p.theme.green100;
      case 'removed':
        return p.theme.red100;
      default:
        return p.theme.backgroundSecondary;
    }
  }};
  color: ${p => {
    switch (p.status) {
      case 'modified':
        return p.theme.yellow400;
      case 'added':
        return p.theme.green400;
      case 'removed':
        return p.theme.red400;
      default:
        return p.theme.textColor;
    }
  }};
  border: 1px solid
    ${p => {
      switch (p.status) {
        case 'modified':
          return p.theme.yellow300;
        case 'added':
          return p.theme.green300;
        case 'removed':
          return p.theme.red300;
        default:
          return p.theme.border;
      }
    }};
`;

const FileDiffContainer = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundTertiary};
  padding: ${p => p.theme.space.lg};
`;

const DiffSectionContainer = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  background: ${p => p.theme.background};
`;

const DiffSectionHeader = styled('div')`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const DiffLinesContainer = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
`;

const DiffLine = styled('div')<{lineType: DiffLineType}>`
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

  &:hover {
    background: ${p => {
      switch (p.lineType) {
        case 'added':
          return p.theme.green100;
        case 'removed':
          return p.theme.red100;
        default:
          return p.theme.backgroundSecondary;
      }
    }};
  }
`;

const DiffLineNumber = styled('div')<{lineType: DiffLineType}>`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  width: 50px;
  padding: 0 ${p => p.theme.space.md};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  color: ${p => p.theme.subText};
  user-select: none;
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
  border-right: 1px solid
    ${p => {
      switch (p.lineType) {
        case 'added':
          return p.theme.green300;
        case 'removed':
          return p.theme.red300;
        default:
          return p.theme.border;
      }
    }};

  &:first-of-type {
    border-right: 1px solid ${p => p.theme.innerBorder};
  }
`;

const DiffLineCode = styled('div')<{lineType: DiffLineType}>`
  flex: 1;
  padding: 0 ${p => p.theme.space.lg};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  color: ${p => p.theme.textColor};
  white-space: pre;
  overflow-x: auto;
  line-height: 1.5;
`;

const DiffPrefix = styled('span')`
  margin-right: ${p => p.theme.space.sm};
  user-select: none;
`;

const ChevronIcon = styled(IconChevron)<{isExpanded: boolean}>`
  flex-shrink: 0;
  width: ${p => p.theme.space.xl};
  height: ${p => p.theme.space.xl};
  transition: transform 0.15s ease;
  transform: rotate(${p => (p.isExpanded ? '0deg' : '90deg')});
  color: ${p => p.theme.headingColor};
`;
