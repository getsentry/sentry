import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text/heading';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons';
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
      <AnimatePresence>
        {isOpen && (
          <Backdrop
            key="backdrop"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.1}}
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      <SlideOverPanel
        collapsed={!isOpen}
        slidePosition="right"
        panelWidth="502px"
        ariaLabel="App size insights details"
      >
        <Flex height="100%" direction="column">
          {/* Header */}
          <Header padding="xl" align="center" justify="between">
            <Heading as="h2" size="xl">
              Insights
            </Heading>
            <CloseButton
              size="sm"
              icon={<IconClose />}
              aria-label="Close sidebar"
              onClick={onClose}
            />
          </Header>

          {/* Insights list */}
          <Flex flex={1} overflowY="auto" padding="xl">
            <Flex direction="column" gap="xl" width="100%">
              {processedInsights.map(insight => (
                <AppSizeInsightsSidebarRow
                  key={insight.name}
                  insight={insight}
                  isExpanded={expandedInsights.has(insight.name)}
                  onToggleExpanded={() => toggleExpanded(insight.name)}
                />
              ))}
            </Flex>
          </Flex>
        </Flex>
      </SlideOverPanel>
    </Fragment>
  );
}

const Backdrop = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  pointer-events: auto;
`;

const CloseButton = styled(Button)`
  color: ${p => p.theme.subText};
`;

const Header = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.border};
`;
