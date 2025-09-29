import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text/heading';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import {AppSizeInsightsSidebarRow} from 'sentry/views/preprod/buildDetails/main/insights/appSizeInsightsSidebarRow';
import type {ProcessedInsight} from 'sentry/views/preprod/utils/insightProcessing';

interface AppSizeInsightsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  processedInsights: ProcessedInsight[];
}

export function AppSizeInsightsSidebar({
  processedInsights,
  isOpen,
  onClose,
}: AppSizeInsightsSidebarProps) {
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());

  const {
    isHeld,
    onDoubleClick,
    onMouseDown,
    size: width,
  } = useResizableDrawer({
    direction: 'right',
    initialSize: 502,
    min: 502,
    onResize: () => {},
    sizeStorageKey: 'app-size-insights-sidebar-width',
  });

  const toggleExpanded = (insightName: string) => {
    const newExpanded = new Set(expandedInsights);
    if (newExpanded.has(insightName)) {
      newExpanded.delete(insightName);
    } else {
      newExpanded.add(insightName);
    }
    setExpandedInsights(newExpanded);
  };

  // Constrain width to viewport (leave 50px margin from screen edge)
  const constrainedWidth = Math.min(width, window.innerWidth - 50);

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
        panelWidth={`${constrainedWidth}px`}
        ariaLabel={t('App size insights details')}
      >
        <Flex height="100%" direction="column">
          <Header padding="xl" align="center" justify="between">
            <Heading as="h2" size="xl">
              {t('Insights')}
            </Heading>
            <Button
              size="sm"
              icon={<IconClose />}
              aria-label={t('Close sidebar')}
              onClick={onClose}
            />
          </Header>

          <Flex flex={1} position="relative" overflow="hidden">
            <ResizeHandle
              onMouseDown={onMouseDown}
              onDoubleClick={onDoubleClick}
              data-is-held={isHeld}
              data-slide-direction="leftright"
            >
              <IconGrabbable size="sm" />
            </ResizeHandle>

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

const Header = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.border};
`;

const ResizeHandle = styled(Flex)`
  position: absolute;
  left: 0;
  top: 0;
  width: ${p => p.theme.space.xl};
  height: 100%;
  align-items: center;
  justify-content: center;
  z-index: 10;
  cursor: ew-resize;
  background: transparent;

  &:hover,
  &[data-is-held='true'] {
    background: ${p => p.theme.hover};
  }

  &[data-is-held='true'] {
    user-select: none;
  }

  svg {
    color: ${p => p.theme.subText};
    transform: rotate(90deg);
  }
`;
