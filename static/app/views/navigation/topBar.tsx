import {useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import {mergeProps} from '@react-aria/utils';

import {Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';
import {slot, withSlots} from '@sentry/scraps/slot';
import {Heading} from '@sentry/scraps/text';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SearchButton} from 'sentry/views/navigation/searchButton';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';
import {AskSeerButton} from 'sentry/views/seerExplorer/components/askSeerButton';
import {useSeerExplorerChatState} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {
  getExplorerFeedbackOptions,
  isSeerExplorerEnabled,
} from 'sentry/views/seerExplorer/utils';

import {
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
  PRIMARY_HEADER_HEIGHT,
  TOP_BAR_HEIGHT_CSS_VAR,
} from './constants';

const Slot = slot(['breadcrumbs', 'title', 'search', 'actions', 'feedback'] as const);

function TopBarContent() {
  const theme = useTheme();
  const {barTop, contentTop} = useTopOffset();

  const organization = useOrganization({allowNull: true});

  useEffect(() => {
    document.documentElement.style.setProperty(TOP_BAR_HEIGHT_CSS_VAR, contentTop);
    return () => {
      document.documentElement.style.removeProperty(TOP_BAR_HEIGHT_CSS_VAR);
    };
  }, [contentTop]);

  const {isOpen: isSeerExplorerOpen} = useSeerExplorerContext();
  const {runId: seerExplorerRunId} = useSeerExplorerChatState();

  const feedbackOptions = useMemo(() => {
    if (isSeerExplorerOpen) {
      return getExplorerFeedbackOptions(seerExplorerRunId);
    }
    return {tags: {['feedback.source']: 'top_navigation'}};
  }, [isSeerExplorerOpen, seerExplorerRunId]);

  return (
    <Flex
      as="header"
      height={{
        'screen:sm': `${NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME}px`,
        'screen:md': `${PRIMARY_HEADER_HEIGHT}px`,
      }}
      justify="between"
      background="secondary"
      align="center"
      padding={{'screen:sm': 'sm lg', 'screen:md': 'md xl'}}
      position="sticky"
      borderBottom="primary"
      top={barTop}
      style={{
        zIndex: theme.zIndex.sidebarPanel - 1,
      }}
    >
      <SizeProvider size="sm">
        {/*
         * Breadcrumbs and the title are separate slots so the title slot always
         * owns the page heading. BreadcrumbList.Title renders title content
         * without a heading, while this outlet supplies the single <h1>.
         *
         * The title occupies the remaining inline space (the header is
         * justify="between", so this absorbs the empty middle; content stays
         * left-aligned and actions stay pinned right). This is required by any
         * title-slot child that establishes a container query.
         */}
        <Flex
          align="center"
          gap="sm"
          minWidth="0"
          flexGrow={1}
          containerType="inline-size"
        >
          <Slot.Outlet name="breadcrumbs">
            {(props, hasConsumers) => (
              <Flex
                {...props}
                align="center"
                gap="sm"
                minWidth="0"
                flex="0 1 auto"
                display={hasConsumers ? 'flex' : 'none'}
              />
            )}
          </Slot.Outlet>

          <Slot.Outlet name="title">
            {props => (
              <Flex align="center" gap="sm" minWidth="0" flexGrow={1}>
                {flexProps => (
                  <Heading as="h1" variant="inherit" {...mergeProps(flexProps, props)} />
                )}
              </Flex>
            )}
          </Slot.Outlet>
        </Flex>

        <Flex align="center" gap="sm">
          <Slot.Outlet name="search">
            {props => <Flex {...props} align="center" gap="sm" />}
          </Slot.Outlet>

          <Slot.Outlet name="actions">
            {props => <Flex {...props} align="center" gap="sm" />}
          </Slot.Outlet>

          <SearchButton />
          {isSeerExplorerEnabled(organization) ? <AskSeerButton /> : null}

          <Slot.Outlet name="feedback">
            {props => (
              <Flex {...props}>
                {/* If no component registers a feedback button, show the default one */}
                <Slot.Fallback>
                  <FeedbackButton
                    aria-label={t('Give Feedback')}
                    feedbackOptions={feedbackOptions}
                    tooltipProps={{title: t('Give Feedback')}}
                  >
                    {null}
                  </FeedbackButton>
                </Slot.Fallback>
              </Flex>
            )}
          </Slot.Outlet>
        </Flex>
      </SizeProvider>
    </Flex>
  );
}

export const TopBar = withSlots(TopBarContent, Slot);
