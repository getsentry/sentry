import {usePrompt} from 'sentry/actionCreators/prompts';
import {useRollback} from 'sentry/components/sidebar/rollback/useRollback';
import useOrganization from 'sentry/utils/useOrganization';

export function useRollbackPrompts({collapsed}: {collapsed: boolean}) {
  const organization = useOrganization();
  const hasRollback = organization.features.includes('sentry-rollback-2024');
  const {data} = useRollback();

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
    shouldShowSidebarBanner: hasRollback && data && !isSidebarPromptDismissed,
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
