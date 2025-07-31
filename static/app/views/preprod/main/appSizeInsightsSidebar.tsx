import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconChevron, IconClose} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {
  AppleInsightResults,
  OptimizableImageFile,
} from 'sentry/views/preprod/types/appSizeTypes';
import {
  formatPercentage,
  formatSavingsAmount,
} from 'sentry/views/preprod/utils/formatters';
import {
  type ProcessedInsightFile,
  processInsights,
} from 'sentry/views/preprod/utils/insightProcessing';

interface AppSizeInsightsSidebarProps {
  insights: AppleInsightResults;
  isOpen: boolean;
  onClose: () => void;
  totalSize: number;
}

interface FileRowProps {
  file: ProcessedInsightFile;
  fileIndex: number;
}

/**
 * Flexible file row component that can handle different file types
 * This allows for custom display logic based on file type in the future
 */
function FileRow({file, fileIndex}: FileRowProps) {
  const isAlternating = fileIndex % 2 === 0;

  // Custom display logic based on file type
  if (file.fileType === 'optimizable_image' && file.originalFile) {
    return (
      <OptimizableImageFileRow
        file={file}
        originalFile={file.originalFile as OptimizableImageFile}
        isAlternating={isAlternating}
      />
    );
  }

  // Default display for all other file types
  return (
    <FileItem isAlternating={isAlternating}>
      <FilePath>{file.path}</FilePath>
      <FileSavings>
        <FileSavingsAmount>{formatSavingsAmount(-file.savings)}</FileSavingsAmount>
        <FileSavingsPercentage>
          ({formatPercentage(-file.percentage)})
        </FileSavingsPercentage>
      </FileSavings>
    </FileItem>
  );
}

/**
 * Custom file row component for OptimizableImageFile
 * Ready for future custom display enhancements
 */
function OptimizableImageFileRow({
  file,
  originalFile: _originalFile,
  isAlternating,
}: {
  file: ProcessedInsightFile;
  isAlternating: boolean;
  originalFile: OptimizableImageFile;
}) {
  return (
    <FileItem isAlternating={isAlternating}>
      <FilePath>{file.path}</FilePath>
      <FileSavings>
        <FileSavingsAmount>{formatSavingsAmount(-file.savings)}</FileSavingsAmount>
        <FileSavingsPercentage>
          ({formatPercentage(-file.percentage)})
        </FileSavingsPercentage>
      </FileSavings>
    </FileItem>
  );
}

export function AppSizeInsightsSidebar({
  insights,
  totalSize,
  isOpen,
  onClose,
}: AppSizeInsightsSidebarProps) {
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());

  // Process insights using shared logic
  const processedInsights = processInsights(insights, totalSize);

  const toggleExpanded = (insightName: string) => {
    const newExpanded = new Set(expandedInsights);
    if (newExpanded.has(insightName)) {
      newExpanded.delete(insightName);
    } else {
      newExpanded.add(insightName);
    }
    setExpandedInsights(newExpanded);
  };

  return (
    <Fragment>
      {isOpen && <Backdrop onClick={onClose} />}
      <SlideOverPanel
        collapsed={!isOpen}
        slidePosition="right"
        panelWidth="502px"
        ariaLabel="App size insights details"
      >
        <SidebarContainer>
          <Header>
            <Title>Insights</Title>
            <CloseButton
              size="sm"
              icon={<IconClose />}
              aria-label="Close sidebar"
              onClick={onClose}
            />
          </Header>

          <InsightsContent>
            {processedInsights.map(insight => {
              const isExpanded = expandedInsights.has(insight.name);
              return (
                <InsightCard key={insight.name}>
                  <InsightHeader>
                    <InsightTitle>{insight.name}</InsightTitle>
                    <SavingsInfo>
                      <SavingsText>
                        Potential savings {formatSavingsAmount(insight.totalSavings)}
                      </SavingsText>
                      <SavingsPercentage>
                        {formatPercentage(-insight.percentage)}
                      </SavingsPercentage>
                    </SavingsInfo>
                  </InsightHeader>

                  <InsightDescription>{insight.description}</InsightDescription>

                  <FilesSection>
                    <FilesToggle
                      isExpanded={isExpanded}
                      onClick={() => toggleExpanded(insight.name)}
                    >
                      <ToggleIcon isExpanded={isExpanded} />
                      <FilesCount>{insight.files.length} files</FilesCount>
                    </FilesToggle>

                    {isExpanded && (
                      <FilesList>
                        {insight.files.map((file, fileIndex) => (
                          <FileRow
                            key={`${file.path}-${fileIndex}`}
                            file={file}
                            fileIndex={fileIndex}
                          />
                        ))}
                      </FilesList>
                    )}
                  </FilesSection>
                </InsightCard>
              );
            })}
          </InsightsContent>
        </SidebarContainer>
      </SlideOverPanel>
    </Fragment>
  );
}

const SidebarContainer = styled('div')`
  height: 100%;
  display: flex;
  flex-direction: column;
  background: ${p => p.theme.background};
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(3)} ${space(3)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const Title = styled('h2')`
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  color: ${p => p.theme.textColor};
`;

const CloseButton = styled(Button)`
  color: ${p => p.theme.subText};
`;

const InsightsContent = styled('div')`
  flex: 1;
  overflow-y: auto;
  padding: ${space(3)};
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

const InsightCard = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 8px;
  padding: ${space(2)};
`;

const InsightHeader = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const InsightTitle = styled('h3')`
  font-family: 'Rubik', sans-serif;
  font-weight: 600;
  font-size: 14px;
  line-height: 1.4;
  letter-spacing: 0;
  vertical-align: middle;
  font-variant-numeric: lining-nums tabular-nums;
  margin: 0;
  color: ${p => p.theme.textColor};
`;

const SavingsInfo = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
  flex-shrink: 0;
`;

const SavingsText = styled('div')`
  font-family: 'Rubik', sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 1.2;
  letter-spacing: 0;
  font-variant-numeric: lining-nums tabular-nums;
  color: ${p => p.theme.subText};
`;

const SavingsPercentage = styled('div')`
  min-width: 56px;
  height: 20px;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${p => p.theme.green100};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Rubik', sans-serif;
  font-weight: 400;
  font-size: 11px;
  line-height: 1;
  letter-spacing: -0.01em;
  font-variant-numeric: lining-nums tabular-nums;
  color: ${p => p.theme.successText};
  white-space: nowrap;
  flex-shrink: 0;
`;

const InsightDescription = styled('p')`
  font-family: 'Rubik', sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 1.2;
  letter-spacing: 0;
  font-variant-numeric: lining-nums tabular-nums;
  color: ${p => p.theme.subText};
  margin-bottom: 12px;
`;

const FilesSection = styled('div')``;

const FilesToggle = styled('button')<{isExpanded: boolean}>`
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 14px;
  color: ${p => p.theme.textColor};
  margin-bottom: ${p => (p.isExpanded ? space(2) : '0')};

  &:hover {
    color: ${p => p.theme.blue400};
  }
`;

const ToggleIcon = styled(IconChevron)<{isExpanded: boolean}>`
  margin-right: ${space(1)};
  transform: ${p => (p.isExpanded ? 'rotate(180deg)' : 'rotate(90deg)')};
  transition: transform 0.2s ease;
  color: inherit;
`;

const FilesCount = styled('span')`
  font-weight: 500;
`;

const FilesList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const FileItem = styled('div')<{isAlternating: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  padding: 4px 6px;
  border-radius: 4px;
  background: ${p => (p.isAlternating ? '#F7F6F9' : 'transparent')};
  border-top: 1px solid transparent;
  min-width: 0;
`;

const FilePath = styled('span')`
  font-family: ${p => p.theme.text.family};
  font-weight: 500;
  font-size: 12px;
  line-height: 1;
  letter-spacing: 0;
  text-align: left;
  font-variant-numeric: lining-nums tabular-nums;
  color: ${p => p.theme.purple400};
  flex: 1;
  margin-right: ${space(2)};
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;

  &:hover {
    text-decoration: underline;
  }
`;

// const ImageFileInfo = styled('div')`
//   display: flex;
//   flex-direction: column;
//   flex: 1;
//   min-width: 0;
//   margin-right: ${space(2)};
// `;

// const OptimizationType = styled('span')`
//   font-family: 'Rubik', sans-serif;
//   font-weight: 400;
//   font-size: 10px;
//   line-height: 1;
//   letter-spacing: 0;
//   color: ${p => p.theme.subText};
//   margin-top: 2px;
// `;

const FileSavings = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const FileSavingsAmount = styled('span')`
  font-family: 'Rubik', sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 1.2;
  letter-spacing: 0;
  font-variant-numeric: lining-nums tabular-nums;
  color: ${p => p.theme.textColor};
`;

const FileSavingsPercentage = styled('span')`
  font-family: 'Rubik', sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 1.2;
  letter-spacing: 0;
  text-align: right;
  width: 64px;
  font-variant-numeric: lining-nums tabular-nums;
  color: ${p => p.theme.subText};
`;

const Backdrop = styled('div')`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: ${p => p.theme.zIndex.modal - 2};
  cursor: pointer;
`;
