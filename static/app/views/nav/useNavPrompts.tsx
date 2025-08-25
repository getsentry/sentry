import {usePrompt} from 'sentry/actionCreators/prompts';
import type {Organization} from 'sentry/types/organization';

export function useNavPrompts({
  collapsed,
  organization,
}: {
  collapsed: boolean;
  organization: Organization | null;
}) {
  const {
    isPromptDismissed: isSidebarPromptDismissed,
    dismissPrompt: dismissSidebarPrompt,
  } = usePrompt({
    feature: 'stacked_navigation_banner',
    organization,
  });

  const {
    isPromptDismissed: isDropdownPromptDismissed,
    dismissPrompt: dismissDropdownPrompt,
  } = usePrompt({
    feature: 'stacked_navigation_help_menu',
    organization,
  });

  const shouldShowHelpMenuDot =
    isDropdownPromptDismissed === false && (collapsed || isSidebarPromptDismissed);

  return {
    shouldShowSidebarBanner: !collapsed && isSidebarPromptDismissed === false,
    shouldShowHelpMenuDot,
    onOpenHelpMenu: () => {
      if (shouldShowHelpMenuDot) {
        dismissDropdownPrompt();
      }
    },
    onDismissSidebarBanner: dismissSidebarPrompt,
  };
}
