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

const topBarSlot = slot(['Title', 'Actions', 'Feedback'] as const);

export const TopBarSlotProvider = topBarSlot.Provider;

export const TopBarSlots = {
  ...topBarSlot.slot,
};

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
        <TopBarSlots.Title.Root>
          {props => <Flex {...props} align="center" gap="sm" />}
        </TopBarSlots.Title.Root>

        <Flex align="center" gap="sm">
          <TopBarSlots.Actions.Root>
            {props => {
              return <Flex {...props} align="center" gap="sm" />;
            }}
          </TopBarSlots.Actions.Root>

          {organization && isSeerExplorerEnabled(organization) ? (
            <Button icon={<IconSeer />} onClick={openExplorerPanel}>
              {t('Ask Seer')}
            </Button>
          ) : null}

          <TopBarSlots.Feedback.Root>
            {props => (
              <Flex {...props}>
                {/* If no component registers a feedback button, show the default one */}
                <TopBarSlots.Feedback.Fallback>
                  <FeedbackButton
                    aria-label={t('Give Feedback')}
                    feedbackOptions={{tags: {'feedback.source': 'top_navigation'}}}
                  >
                    {null}
                  </FeedbackButton>
                </TopBarSlots.Feedback.Fallback>
              </Flex>
            )}
          </TopBarSlots.Feedback.Root>
        </Flex>
      </SizeProvider>
    </Flex>
  );
}
