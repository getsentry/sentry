import {usePrompt} from 'sentry/actionCreators/prompts';
import type {Organization} from 'sentry/types/organization';

export function useNavPrompts({
  collapsed,
  organization,
}: {
  collapsed: boolean;
  organization: Organization | null;
}) {
  const hasNavigationV2Banner = organization?.features.includes('navigation-sidebar-v2');

  const {
    isPromptDismissed: isSidebarPromptDismissed,
    dismissPrompt: dismissSidebarPrompt,
  } = usePrompt({
    feature: 'stacked_navigation_banner',
    organization,
    options: {enabled: hasNavigationV2Banner},
  });

  const {
    isPromptDismissed: isDropdownPromptDismissed,
    dismissPrompt: dismissDropdownPrompt,
  } = usePrompt({
    feature: 'stacked_navigation_help_menu',
    organization,
    options: {enabled: hasNavigationV2Banner},
  });

  const shouldShowHelpMenuDot =
    hasNavigationV2Banner &&
    isDropdownPromptDismissed === false &&
    (collapsed || isSidebarPromptDismissed);

  return {
    shouldShowSidebarBanner:
      hasNavigationV2Banner && !collapsed && isSidebarPromptDismissed === false,
    shouldShowHelpMenuDot,
    onOpenHelpMenu: () => {
      if (shouldShowHelpMenuDot) {
        dismissDropdownPrompt();
      }
    },
    onDismissSidebarBanner: dismissSidebarPrompt,
  };
}
