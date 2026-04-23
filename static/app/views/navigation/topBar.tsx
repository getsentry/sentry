import {useEffect} from 'react';
import {useTheme} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';
import {slot, withSlots} from '@sentry/scraps/slot';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';
import {AskSeerButton} from 'sentry/views/seerExplorer/components/askSeerButton';

import {
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
  PRIMARY_HEADER_HEIGHT,
  TOP_BAR_HEIGHT_CSS_VAR,
} from './constants';

const Slot = slot(['title', 'actions', 'feedback'] as const, {
  providers: ({children}) => <SizeProvider size="sm">{children}</SizeProvider>,
});

function TopBarContent() {
  const theme = useTheme();
  const hasPageFrame = useHasPageFrameFeature();
  const {barTop, contentTop} = useTopOffset();

  useEffect(() => {
    document.documentElement.style.setProperty(TOP_BAR_HEIGHT_CSS_VAR, contentTop);
    return () => {
      document.documentElement.style.removeProperty(TOP_BAR_HEIGHT_CSS_VAR);
    };
  }, [contentTop]);

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
        <Slot.Outlet name="title">
          {props => <Flex {...props} align="center" gap="sm" />}
        </Slot.Outlet>

        <Flex align="center" gap="sm">
          <Slot.Outlet name="actions">
            {props => <Flex {...props} align="center" gap="sm" />}
          </Slot.Outlet>

          <AskSeerButton />

          <Slot.Outlet name="feedback">
            {props => (
              <Flex {...props}>
                {/* If no component registers a feedback button, show the default one */}
                <Slot.Fallback>
                  <FeedbackButton
                    aria-label={t('Give Feedback')}
                    feedbackOptions={{tags: {'feedback.source': 'top_navigation'}}}
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
