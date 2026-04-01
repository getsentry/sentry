import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {useExplorerPanel} from 'sentry/views/seerExplorer/useExplorerPanel';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

import {NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME} from './constants';
import {PRIMARY_HEADER_HEIGHT} from './constants';

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
      // Keep the top bar in a cascade slightly below the sidebar panel so that when the sidebar panel
      // is in the hover preview state, the top bar does not sit over it.
      style={{
        zIndex: theme.zIndex.sidebarPanel - 1,
      }}
    >
      <SizeProvider size="sm">
        {/* @TODO(JonasBadalic): Implement breadcrumbs here */}
        <Flex />
        <Flex align="center" gap="md">
          {organization && isSeerExplorerEnabled(organization) ? (
            <Button icon={<IconSeer />} onClick={openExplorerPanel}>
              {t('Ask Seer')}
            </Button>
          ) : null}
          <FeedbackButton
            aria-label={t('Give Feedback')}
            feedbackOptions={{tags: {'feedback.source': 'top_navigation'}}}
          >
            {null}
          </FeedbackButton>
        </Flex>
      </SizeProvider>
    </Flex>
  );
}
