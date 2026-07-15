import {useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import {mergeProps} from '@react-aria/utils';

import {Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';
import {slot, withSlots} from '@sentry/scraps/slot';
import {Heading, Text} from '@sentry/scraps/text';

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

const Slot = slot(['title', 'search', 'actions', 'feedback'] as const);

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
         * The title slot is rendered as a semantic <h1> by default so the page
         * title (whatever a view routes into it — breadcrumbs, text, etc.) is
         * exposed as the page heading. Consumers that render a heading inside
         * the slot can pass `as="div"` to avoid nesting headings.
         * Flex's render function applies the layout className to that same
         * element.
         *
         * flexGrow={1} lets the title occupy the available inline space (the
         * header is justify="between", so this just absorbs the empty middle;
         * content stays left-aligned, actions stay pinned right). This is
         * required by any title-slot child that establishes a container query
         * (e.g. BreadcrumbList's `container-type: inline-size`): without a
         * definite inline size to resolve against, size containment collapses
         * the child to 0 width and its container queries always read as narrow.
         */}
        <Slot.Outlet name="title">
          {props => (
            <Flex align="center" gap="sm" minWidth="0" flexGrow={1}>
              {flexProps => {
                const {as, ...slotProps} = props;
                const mergedProps = mergeProps(flexProps, slotProps);

                return as ? (
                  <Text as={as} variant="inherit" {...mergedProps}>
                    {null}
                  </Text>
                ) : (
                  <Heading as="h1" variant="inherit" {...mergedProps} />
                );
              }}
            </Flex>
          )}
        </Slot.Outlet>

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
