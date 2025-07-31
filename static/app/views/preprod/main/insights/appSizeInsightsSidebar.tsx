import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Container} from 'sentry/components/core/layout/container';
import {Heading} from 'sentry/components/core/text/heading';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconChevron, IconClose} from 'sentry/icons';
import {AppSizeInsightsSidebarRow} from 'sentry/views/preprod/main/insights/appSizeInsightsSidebarRow';
import type {AppleInsightResults} from 'sentry/views/preprod/types/appSizeTypes';
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

export interface FileRowProps {
  file: ProcessedInsightFile;
  fileIndex: number;
}

export function AppSizeInsightsSidebar({
  insights,
  totalSize,
  isOpen,
  onClose,
}: AppSizeInsightsSidebarProps) {
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());

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
          {/* Header */}
          <Container
            display="flex"
            padding="xl"
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

          {/* Insights list */}
          <Container
            style={{
              flex: 1,
              overflowY: 'auto',
            }}
            padding="xl"
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
              {processedInsights.map(insight => (
                <AppSizeInsightsSidebarRow
                  key={insight.name}
                  insight={insight}
                  isExpanded={expandedInsights.has(insight.name)}
                  onToggleExpanded={() => toggleExpanded(insight.name)}
                />
              ))}
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

export const SavingsPercentage = styled('div')`
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

export const FilesToggle = styled('button')<{isExpanded: boolean}>`
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 14px;
  color: ${p => p.theme.textColor};
  margin-bottom: ${p => (p.isExpanded ? p.theme.space.md : '0')};

  &:hover {
    color: ${p => p.theme.blue400};
  }
`;

export const ToggleIcon = styled(IconChevron)<{isExpanded: boolean}>`
  margin-right: ${p => p.theme.space.xs};
  transform: ${p => (p.isExpanded ? 'rotate(180deg)' : 'rotate(90deg)')};
  transition: transform 0.2s ease;
  color: inherit;
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
