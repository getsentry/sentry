import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconChevron, IconClose} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {
  AppleInsightResults,
  FileSavingsResult,
  FileSavingsResultGroup,
  FilesInsightResult,
  GroupsInsightResult,
  OptimizableImageFile,
  StripBinaryFileInfo,
} from 'sentry/views/preprod/types/appSizeTypes';
import {
  formatPercentage,
  formatSavingsAmount,
} from 'sentry/views/preprod/utils/formatters';

interface AppSizeInsightsSidebarProps {
  insights: AppleInsightResults;
  isOpen: boolean;
  onClose: () => void;
  totalSize: number;
}

interface ProcessedInsight {
  description: string;
  files: Array<{
    path: string;
    percentage: number;
    savings: number;
  }>;
  name: string;
  percentage: number;
  totalSavings: number;
}

export function AppSizeInsightsSidebar({
  insights,
  totalSize,
  isOpen,
  onClose,
}: AppSizeInsightsSidebarProps) {
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());

  // Process insights into a standardized format
  const processedInsights: ProcessedInsight[] = [];

  // Image optimization insight
  if (insights.image_optimization?.total_savings) {
    const insight = insights.image_optimization;
    processedInsights.push({
      name: 'Optimize images',
      description:
        'We determine how much size could be saved if images were compressed. In some cases you can convert to WebP for better compression.',
      totalSavings: insight.total_savings,
      percentage: (insight.total_savings / totalSize) * 100,
      files: insight.optimizable_files.map((file: OptimizableImageFile) => ({
        path: file.file_path,
        savings: file.potential_savings || 0,
        percentage: ((file.potential_savings || 0) / totalSize) * 100,
      })),
    });
  }

  // Duplicate files insight
  if (insights.duplicate_files?.total_savings) {
    const insight = insights.duplicate_files as GroupsInsightResult;
    processedInsights.push({
      name: 'Remove duplicate files',
      description:
        'Multiple copies of the same file were found, expand each to see the duplicates. Move files to shared locations to save space.',
      totalSavings: insight.total_savings,
      percentage: (insight.total_savings / totalSize) * 100,
      files: insight.groups.flatMap((group: FileSavingsResultGroup) =>
        group.files.map((file: FileSavingsResult) => ({
          path: file.file_path,
          savings: file.total_savings,
          percentage: (file.total_savings / totalSize) * 100,
        }))
      ),
    });
  }

  // Strip binary insight
  if (insights.strip_binary?.total_savings) {
    const insight = insights.strip_binary;
    processedInsights.push({
      name: 'Strip Binary Symbols',
      description:
        'Debug symbols and symbol tables can be removed from binaries to reduce size.',
      totalSavings: insight.total_savings,
      percentage: (insight.total_savings / totalSize) * 100,
      files: insight.files.map((file: StripBinaryFileInfo) => ({
        path: file.file_path,
        savings: file.total_savings,
        percentage: (file.total_savings / totalSize) * 100,
      })),
    });
  }

  // Add other insights using similar pattern
  const otherInsightTypes = [
    {
      key: 'main_binary_exported_symbols',
      name: 'Remove Symbol Metadata',
      description: 'Symbol metadata can be removed to reduce binary size.',
    },
    {
      key: 'large_images',
      name: 'Compress large images',
      description: 'Large image files can be compressed to reduce size.',
    },
    {
      key: 'large_videos',
      name: 'Compress large videos',
      description: 'Large video files can be compressed to reduce size.',
    },
    {
      key: 'large_audio',
      name: 'Compress large audio files',
      description: 'Large audio files can be compressed to reduce size.',
    },
    {
      key: 'unnecessary_files',
      name: 'Remove unnecessary files',
      description: 'Files that are not needed can be removed to save space.',
    },
    {
      key: 'localized_strings',
      name: 'Optimize localized strings',
      description: 'Localized string files can be optimized to reduce size.',
    },
    {
      key: 'small_files',
      name: 'Optimize small files',
      description: 'Small files can be optimized or bundled to reduce overhead.',
    },
  ] as const;

  otherInsightTypes.forEach(({key, name, description}) => {
    const insight = insights[key as keyof AppleInsightResults] as
      | FilesInsightResult
      | undefined;
    if (insight?.total_savings) {
      processedInsights.push({
        name,
        description,
        totalSavings: insight.total_savings,
        percentage: (insight.total_savings / totalSize) * 100,
        files: insight.files.map((file: FileSavingsResult) => ({
          path: file.file_path,
          savings: file.total_savings,
          percentage: (file.total_savings / totalSize) * 100,
        })),
      });
    }
  });

  // Sort by total savings (descending)
  processedInsights.sort((a, b) => b.totalSavings - a.totalSavings);

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
                        −{formatPercentage(insight.percentage)}
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
                          <FileItem
                            key={`${file.path}-${fileIndex}`}
                            isAlternating={fileIndex % 2 === 0}
                          >
                            <FilePath>{file.path}</FilePath>
                            <FileSavings>
                              <FileSavingsAmount>
                                −{formatSavingsAmount(file.savings)}
                              </FileSavingsAmount>
                              <FileSavingsPercentage>
                                (−{formatPercentage(file.percentage)})
                              </FileSavingsPercentage>
                            </FileSavings>
                          </FileItem>
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
