import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';
import {slot} from '@sentry/scraps/slot';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {useExplorerPanel} from 'sentry/views/seerExplorer/useExplorerPanel';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

import {
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
  PRIMARY_HEADER_HEIGHT,
} from './constants';

export const TopBarSlot = slot(['Title', 'Actions', 'Feedback'] as const);

export function TopBar() {
  const theme = useTheme();
  const organization = useOrganization({allowNull: true});
  const hasPageFrame = useHasPageFrameFeature();

  const {openExplorerPanel} = useExplorerPanel();

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
      top={0}
      style={{
        zIndex: theme.zIndex.sidebarPanel - 1,
      }}
    >
      <SizeProvider size="sm">
        <TopBarSlot.Outlet name="Title">
          {props => <Flex {...props} align="center" gap="sm" />}
        </TopBarSlot.Outlet>

        <Flex align="center" gap="sm">
          <TopBarSlot.Outlet name="Actions">
            {props => <Flex {...props} align="center" gap="sm" />}
          </TopBarSlot.Outlet>

          {organization && isSeerExplorerEnabled(organization) ? (
            <Button icon={<IconSeer />} onClick={openExplorerPanel}>
              {t('Ask Seer')}
            </Button>
          ) : null}

          <TopBarSlot.Outlet name="Feedback">
            {props => (
              <Flex {...props}>
                {/* If no component registers a feedback button, show the default one */}
                <TopBarSlot.Fallback name="Feedback">
                  <FeedbackButton
                    aria-label={t('Give Feedback')}
                    feedbackOptions={{tags: {'feedback.source': 'top_navigation'}}}
                  >
                    {null}
                  </FeedbackButton>
                </TopBarSlot.Fallback>
              </Flex>
            )}
          </TopBarSlot.Outlet>
        </Flex>
      </SizeProvider>
    </Flex>
  );
}
