import {useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';
import {slot, withSlots} from '@sentry/scraps/slot';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SearchButton} from 'sentry/views/navigation/searchButton';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
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
  const hasPageFrame = useHasPageFrameFeature();
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

  if (!hasPageFrame) {
    return null;
  }

  return (
    <Flex
      height={{
        sm: `${NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME}px`,
        md: `${PRIMARY_HEADER_HEIGHT}px`,
      }}
      justify="between"
      background="secondary"
      align="center"
      padding={{sm: 'sm lg', md: 'md xl'}}
      position="sticky"
      borderBottom="primary"
      top={barTop}
      style={{
        zIndex: theme.zIndex.sidebarPanel - 1,
      }}
    >
      <SizeProvider size="sm">
        {/*
         * The title slot is rendered as a semantic <h1> so the page title
         * (whatever a view routes into it — breadcrumbs, text, etc.) is exposed
         * as the page heading. TitleHeading inherits the TopBar typography, so
         * it carries no visual weight of its own.
         */}
        <Slot.Outlet name="title">{props => <TitleHeading {...props} />}</Slot.Outlet>

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

const TitleHeading = styled('h1')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  margin: 0;
  min-width: 0;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
`;

export const TopBar = withSlots(TopBarContent, Slot);
