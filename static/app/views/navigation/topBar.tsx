import {useTheme} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout';

import {useOrganization} from 'sentry/utils/useOrganization';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';

import {PRIMARY_HEADER_HEIGHT} from './constants';

export function TopBar() {
  const theme = useTheme();
  const organization = useOrganization({allowNull: true});
  const secondaryNavigation = useSecondaryNavigation();

  if (!organization?.features.includes('page-frame')) {
    return null;
  }

  return (
    <Flex
      // We need to subtract 1px to align with the sidebar border because in this case,
      // the border is actually applies onto the next element after the page frame so that the top radius is visible
      height={`${PRIMARY_HEADER_HEIGHT}px`}
      borderBottom={secondaryNavigation.view === 'expanded' ? undefined : 'primary'}
      justify="between"
      background="secondary"
      align="center"
      padding="md lg"
      position="sticky"
      top={0}
      // Keep the top bar in a cascade slightly below the sidebar panel so that when the sidebar panel
      // is in the hover preview state, the top bar does not sit over it.
      style={{zIndex: theme.zIndex.sidebarPanel - 1}}
    />
  );
}
