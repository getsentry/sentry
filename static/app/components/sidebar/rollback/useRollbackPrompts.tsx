import {usePrompt} from 'sentry/actionCreators/prompts';
import {useRollback} from 'sentry/components/sidebar/rollback/useRollback';
import type {Organization} from 'sentry/types/organization';

export function useRollbackPrompts({
  collapsed,
  organization,
}: {
  collapsed: boolean;
  organization: Organization | null;
}) {
  const hasRollback = organization?.features.includes('sentry-rollback-2024') ?? false;
  const {data} = useRollback({organization});

  const {
    isPromptDismissed: isSidebarPromptDismissed,
    dismissPrompt: dismissSidebarPrompt,
  } = usePrompt({
    feature: 'rollback_2024_sidebar',
    organization,
    options: {enabled: hasRollback},
  });

  const {
    isPromptDismissed: isDropdownPromptDismissed,
    dismissPrompt: dismissDropdownPrompt,
  } = usePrompt({
    feature: 'rollback_2024_dropdown',
    organization,
    options: {enabled: hasRollback},
  });

  return {
    shouldShowSidebarBanner:
      hasRollback && data && !collapsed && isSidebarPromptDismissed === false,
    shouldShowDropdownBanner: hasRollback && data,
    shouldShowDot:
      hasRollback &&
      data &&
      isDropdownPromptDismissed === false &&
      (collapsed || isSidebarPromptDismissed),
    onOpenOrgDropdown: () => {
      if (
        hasRollback &&
        isSidebarPromptDismissed === true &&
        isDropdownPromptDismissed === false
      ) {
        dismissDropdownPrompt();
      }
    },
    onDismissSidebarBanner: dismissSidebarPrompt,
  };
}
