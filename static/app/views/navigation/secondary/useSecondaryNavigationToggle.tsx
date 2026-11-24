import {IconChevron} from '@sentry/icons/chevron';

import type {ButtonProps} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';

/**
 * Props for a button that collapses or expands the secondary sidebar.
 */
export function useSecondaryNavigationToggle() {
  const {view, setView} = useSecondaryNavigation();
  const isCollapsed = view !== 'expanded';

  return {
    'aria-label': isCollapsed ? t('Expand') : t('Collapse'),
    icon: <IconChevron direction={isCollapsed ? 'right' : 'left'} isDouble />,
    onClick: () => setView(isCollapsed ? 'expanded' : 'collapsed'),
    analyticsEventName: 'Sidebar: Secondary Toggle Button Clicked',
    analyticsEventKey: 'sidebar_secondary_toggle_button_clicked',
    analyticsParams: {is_collapsed: isCollapsed},
  } satisfies Partial<ButtonProps>;
}
