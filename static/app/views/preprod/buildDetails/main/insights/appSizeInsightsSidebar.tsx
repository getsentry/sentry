import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {SlideOverPanel} from '@sentry/scraps/slideOverPanel';
import {Heading} from '@sentry/scraps/text/heading';

import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {IconClose, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import {AppSizeInsightsSidebarRow} from 'sentry/views/preprod/buildDetails/main/insights/appSizeInsightsSidebarRow';
import type {Platform} from 'sentry/views/preprod/types/sharedTypes';
import type {ProcessedInsight} from 'sentry/views/preprod/utils/insightProcessing';

interface AppSizeInsightsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  processedInsights: ProcessedInsight[];
  platform?: Platform;
  projectType?: string | null;
}

function getInsightsDocsUrl(platform?: Platform): string {
  if (platform === 'macos' || platform === 'ios') {
    return 'https://docs.sentry.io/platforms/apple/guides/ios/size-analysis/insights/';
  }
  if (platform === 'android') {
    return 'https://docs.sentry.io/platforms/android/size-analysis/insights/';
  }
  return 'https://docs.sentry.io/product/size-analysis/#build-details';
}

export function AppSizeInsightsSidebar({
  processedInsights,
  isOpen,
  onClose,
  platform,
  projectType,
}: AppSizeInsightsSidebarProps) {
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());

  const {
    isHeld,
    onDoubleClick,
    onMouseDown,
    size: width,
  } = useResizableDrawer({
    direction: 'right',
    initialSize: 700,
    min: 700,
    onResize: () => {},
    sizeStorageKey: 'app-size-insights-sidebar-width',
  });

  const toggleExpanded = (insightKey: string) => {
    const newExpanded = new Set(expandedInsights);
    if (newExpanded.has(insightKey)) {
      newExpanded.delete(insightKey);
    } else {
      newExpanded.add(insightKey);
    }
    setExpandedInsights(newExpanded);
  };

  // Constrain width to viewport (leave 50px margin from screen edge)
  const constrainedWidth = Math.min(width, window.innerWidth - 50);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, false);
    return () => {
      document.removeEventListener('keydown', onKeyDown, false);
    };
  }, [onClose]);

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
      {isOpen && (
        <SlideOverPanel
          position="right"
          panelWidth={`${constrainedWidth}px`}
          ariaLabel={t('App size insights details')}
        >
          <Flex height="100%" direction="column">
            <Header padding="xl" align="center" justify="between">
              <Flex align="center" gap="sm">
                <Heading as="h2" size="xl">
                  {t('Insights')}
                </Heading>
                <PageHeadingQuestionTooltip
                  docsUrl={getInsightsDocsUrl(platform)}
                  title={t(
                    'Insights help you identify opportunities to reduce your app size.'
                  )}
                />
              </Flex>
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
                  {processedInsights.map(insight => {
                    const isGroupedInsight =
                      insight.key === 'duplicate_files' || insight.key === 'loose_images';
                    return (
                      <AppSizeInsightsSidebarRow
                        key={insight.key}
                        insight={insight}
                        isExpanded={expandedInsights.has(insight.key)}
                        onToggleExpanded={() => toggleExpanded(insight.key)}
                        platform={platform}
                        projectType={projectType}
                        itemsPerPage={isGroupedInsight ? 10 : undefined}
                      />
                    );
                  })}
                </Flex>
              </Flex>
            </Flex>
          </Flex>
        </SlideOverPanel>
      )}
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
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
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

  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }
  &[data-is-held='true'] {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
    user-select: none;
  }

  svg {
    color: ${p => p.theme.subText};
    transform: rotate(90deg);
  }
`;
