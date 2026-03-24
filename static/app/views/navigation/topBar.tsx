import {useContext, useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';

import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {SecondaryNavigationContext} from 'sentry/views/navigation/secondaryNavigationContext';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {useExplorerPanel} from 'sentry/views/seerExplorer/useExplorerPanel';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

import {PRIMARY_HEADER_HEIGHT} from './constants';

export function TopBar() {
  const theme = useTheme();
  const flexRef = useRef<HTMLDivElement>(null);
  const organization = useOrganization({allowNull: true});
  const primaryNavigation = usePrimaryNavigation();
  const secondaryNavigation = useContext(SecondaryNavigationContext);
  const hasPageFrame = useHasPageFrameFeature();

  useEffect(() => {
    if (!flexRef.current) {
      return undefined;
    }

    if (primaryNavigation.layout === 'mobile') {
      return undefined;
    }

    if (secondaryNavigation?.view !== 'expanded') {
      flexRef.current.style.borderBottom = `1px solid ${theme.tokens.border.primary}`;
      return undefined;
    }

    const handleScroll = () => {
      if (!flexRef.current) {
        return;
      }

      if (primaryNavigation.layout === 'mobile') {
        return;
      }

      // @TODO(JonasBadalic): For the nicest transition possible, we should probably lerp the
      // alpha color channel of the border color betweeen 0 and border radius distance. This would make the
      // two blend nicely together without requiring us to approximate it usign the transition duration.
      flexRef.current.style.borderBottom =
        window.scrollY > 0
          ? `1px solid ${theme.tokens.border.primary}`
          : '1px solid transparent';
    };

    // Set initial state based on current scroll position
    handleScroll();
    window.addEventListener('scroll', handleScroll, {passive: true});
    return () => window.removeEventListener('scroll', handleScroll);
  }, [theme.tokens.border.primary, secondaryNavigation?.view, primaryNavigation.layout]);

  const {openExplorerPanel} = useExplorerPanel();

  if (!hasPageFrame) {
    return null;
  }

  return (
    <Flex
      ref={flexRef}
      height={`${PRIMARY_HEADER_HEIGHT}px`}
      justify="between"
      background="secondary"
      align="center"
      padding="md lg"
      position="sticky"
      borderBottom={primaryNavigation.layout === 'mobile' ? undefined : 'primary'}
      top={0}
      // Keep the top bar in a cascade slightly below the sidebar panel so that when the sidebar panel
      // is in the hover preview state, the top bar does not sit over it.
      style={{
        zIndex: theme.zIndex.sidebarPanel - 1,
        transition: `border-bottom ${theme.motion.enter.slow}`,
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
        </Flex>
      </SizeProvider>
    </Flex>
  );
}
