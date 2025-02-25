import {usePrompt} from 'sentry/actionCreators/prompts';
import type {Organization} from 'sentry/types/organization';

export function useNavPrompts({
  collapsed,
  organization,
}: {
  collapsed: boolean;
  organization: Organization | null;
}) {
  const hasNavigationV2 = organization?.features.includes('navigation-sidebar-v2');

  const {
    isPromptDismissed: isSidebarPromptDismissed,
    dismissPrompt: dismissSidebarPrompt,
  } = usePrompt({
    feature: 'stacked_navigation_banner',
    organization,
    options: {enabled: hasNavigationV2},
  });

  const {
    isPromptDismissed: isDropdownPromptDismissed,
    dismissPrompt: dismissDropdownPrompt,
  } = usePrompt({
    feature: 'stacked_navigation_help_menu',
    organization,
    options: {enabled: hasNavigationV2},
  });

  return {
    shouldShowSidebarBanner:
      hasNavigationV2 && !collapsed && isSidebarPromptDismissed === false,
    shouldShowHelpMenuDot:
      hasNavigationV2 &&
      isDropdownPromptDismissed === false &&
      (collapsed || isSidebarPromptDismissed),
    onOpenHelpMenu: () => {
      if (
        hasNavigationV2 &&
        isSidebarPromptDismissed === true &&
        isDropdownPromptDismissed === false
      ) {
        dismissDropdownPrompt();
      }
    },
    onDismissSidebarBanner: dismissSidebarPrompt,
  };
}
