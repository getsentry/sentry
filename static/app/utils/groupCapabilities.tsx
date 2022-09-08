import {t} from 'sentry/locale';
import {IssueCategory, IssueCategoryCapabilities} from 'sentry/types/group';

/**
 * Defines what capabilities each category of issue supports
 */
const ISSUE_CATEGORY_CAPABILITIES: Record<IssueCategory, IssueCategoryCapabilities> = {
  [IssueCategory.ERROR]: {
    delete: {enabled: true},
    deleteAndDiscard: {enabled: true},
    merge: {enabled: true},
    ignore: {enabled: true},
  },
  [IssueCategory.PERFORMANCE]: {
    delete: {
      enabled: false,
      disabledReason: t('Deleting is not yet supported for performance issues'),
    },
    deleteAndDiscard: {
      enabled: false,
      disabledReason: t('Deleting is not yet supported for performance issues'),
    },
    merge: {
      enabled: false,
      disabledReason: t('Merging is not yet supported for performance issues'),
    },
    // NOTE: The enabled flag is not being used by the ignore dropdown, since only specific suboptions are disabled.
    // I am leaving the disabledReason here so it can be used in tooltips for each disabled dropdown option
    ignore: {
      enabled: false,
      disabledReason: t('This ignore option is not yet supported for performance issues'),
    },
  },
};

/**
 * Checks if an issue supports a specific capability.
 */
export function getIssueCapability(
  issueCategory: IssueCategory,
  capability: keyof IssueCategoryCapabilities
) {
  return ISSUE_CATEGORY_CAPABILITIES[issueCategory][capability] ?? {enabled: false};
}
