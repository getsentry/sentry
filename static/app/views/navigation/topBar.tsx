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
import {useTopBarActionDisplay} from 'sentry/views/navigation/useTopBarActionDisplay';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';
import {AskSeerButton} from 'sentry/views/seerExplorer/components/askSeerButton';
import {useSeerExplorerChatState} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {
  getExplorerFeedbackOptions,
  isSeerExplorerEnabled,
} from 'sentry/views/seerExplorer/utils';

import {
  NAVIGATION_MOBILE_CONTENT_HEIGHT,
  PRIMARY_HEADER_HEIGHT,
  PRIMARY_HEADER_TITLE_MIN_WIDTH,
  TOP_BAR_HEIGHT_CSS_VAR,
} from './constants';

const Slot = slot(['breadcrumbs', 'title', 'search', 'actions', 'feedback'] as const);

function TopBarContent() {
  const theme = useTheme();
  const {pageContentTop} = useTopOffset();

  const organization = useOrganization({allowNull: true});
  const {isSearchInMobileRow} = useTopBarActionDisplay();

  useEffect(() => {
    document.documentElement.style.setProperty(TOP_BAR_HEIGHT_CSS_VAR, pageContentTop);
    return () => {
      document.documentElement.style.removeProperty(TOP_BAR_HEIGHT_CSS_VAR);
    };
  }, [pageContentTop]);

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
      minHeight={{
        'screen:sm': `${NAVIGATION_MOBILE_CONTENT_HEIGHT}px`,
        'screen:md': `${PRIMARY_HEADER_HEIGHT}px`,
      }}
      justify="between"
      background="secondary"
      align="center"
      gap="sm"
      padding={{'screen:sm': 'sm lg', 'screen:md': 'md xl'}}
      position="sticky"
      borderBottom="primary"
      top={0}
      style={{
        zIndex: theme.zIndex.sidebarPanel - 1,
      }}
      wrap="wrap"
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
          flex={`1 1 ${PRIMARY_HEADER_TITLE_MIN_WIDTH}px`}
          containerType="inline-size"
        >
          <Slot.Outlet name="breadcrumbs">
            {(props, hasConsumers) =>
              hasConsumers ? (
                <Flex {...props} align="center" gap="sm" minWidth="0" flex="0 1 auto" />
              ) : null
            }
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
            {(props, hasConsumers) =>
              hasConsumers ? <Flex {...props} align="center" gap="sm" /> : null
            }
          </Slot.Outlet>

          <Slot.Outlet name="actions">
            {(props, hasConsumers) =>
              hasConsumers ? <Flex {...props} align="center" gap="sm" /> : null
            }
          </Slot.Outlet>

          {isSeerExplorerEnabled(organization) ? <AskSeerButton /> : null}
          {isSearchInMobileRow ? null : <SearchButton />}

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
