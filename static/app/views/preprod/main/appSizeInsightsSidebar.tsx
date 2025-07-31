import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Container} from 'sentry/components/core/layout/container';
import {Flex} from 'sentry/components/core/layout/flex';
import {Heading} from 'sentry/components/core/text/heading';
import {Text} from 'sentry/components/core/text/text';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconChevron, IconClose} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {formatBytesBase10SavingsAmount} from 'sentry/utils/bytes/formatBytesBase10';
import type {
  AppleInsightResults,
  OptimizableImageFile,
} from 'sentry/views/preprod/types/appSizeTypes';
import {formatPercentage} from 'sentry/views/preprod/utils/formatters';
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
      <Text
        variant="accent"
        size="sm"
        bold
        ellipsis
        style={{flex: 1, marginRight: '16px', cursor: 'pointer'}}
      >
        {file.path}
      </Text>
      <FileSavings>
        <Text variant="primary" size="sm" tabular>
          {formatBytesBase10SavingsAmount(-file.savings)}
        </Text>
        <Text
          variant="muted"
          size="sm"
          tabular
          style={{width: '64px', textAlign: 'right'}}
        >
          ({formatPercentage(-file.percentage)})
        </Text>
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
      <Text
        variant="accent"
        size="sm"
        bold
        ellipsis
        style={{flex: 1, marginRight: '16px', cursor: 'pointer'}}
      >
        {file.path}
      </Text>
      <FileSavings>
        <Text variant="primary" size="sm" tabular>
          {formatBytesBase10SavingsAmount(-file.savings)}
        </Text>
        <Text
          variant="muted"
          size="sm"
          tabular
          style={{width: '64px', textAlign: 'right'}}
        >
          ({formatPercentage(-file.percentage)})
        </Text>
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
        <Container
          height="100%"
          display="flex"
          style={{flexDirection: 'column'}}
          background="primary"
        >
          <Container
            display="flex"
            padding="lg lg md lg"
            style={{
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #F0ECF3',
            }}
          >
            <Heading as="h2" size="xl">
              Insights
            </Heading>
            <CloseButton
              size="sm"
              icon={<IconClose />}
              aria-label="Close sidebar"
              onClick={onClose}
            />
          </Container>

          <Container
            style={{
              flex: 1,
              overflowY: 'auto',
            }}
            padding="lg"
            display="flex"
          >
            <Container
              display="flex"
              style={{
                flexDirection: 'column',
                gap: '20px',
                width: '100%',
              }}
            >
              {processedInsights.map(insight => {
                const isExpanded = expandedInsights.has(insight.name);
                return (
                  <Flex
                    key={insight.name}
                    background="primary"
                    style={{
                      border: '1px solid #F0ECF3',
                    }}
                    radius="md"
                    padding="md"
                    direction="column"
                    gap="lg"
                  >
                    <Flex align="start" justify="between">
                      <Text variant="primary" size="md" bold>
                        {insight.name}
                      </Text>
                      <Container
                        display="flex"
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: '8px',
                          flexShrink: 0,
                        }}
                      >
                        <Text size="sm" tabular>
                          Potential savings{' '}
                          {formatBytesBase10SavingsAmount(insight.totalSavings)}
                        </Text>
                        <SavingsPercentage>
                          {formatPercentage(-insight.percentage)}
                        </SavingsPercentage>
                      </Container>
                    </Flex>

                    <Text variant="muted" size="sm" as="p">
                      {insight.description}
                    </Text>

                    <Container>
                      <FilesToggle
                        isExpanded={isExpanded}
                        onClick={() => toggleExpanded(insight.name)}
                      >
                        <ToggleIcon isExpanded={isExpanded} />
                        <Text variant="primary" size="md" bold>
                          {insight.files.length} files
                        </Text>
                      </FilesToggle>

                      {isExpanded && (
                        <Container
                          display="flex"
                          style={{
                            flexDirection: 'column',
                            gap: 0,
                          }}
                        >
                          {insight.files.map((file, fileIndex) => (
                            <FileRow
                              key={`${file.path}-${fileIndex}`}
                              file={file}
                              fileIndex={fileIndex}
                            />
                          ))}
                        </Container>
                      )}
                    </Container>
                  </Flex>
                );
              })}
            </Container>
          </Container>
        </Container>
      </SlideOverPanel>
    </Fragment>
  );
}

const CloseButton = styled(Button)`
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

const FileSavings = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
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
