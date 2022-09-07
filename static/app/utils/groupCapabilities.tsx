import {t} from 'sentry/locale';
import {IssueCategory, IssueCategoryCapabilities} from 'sentry/types/group';

/**
 * Defines what capabilities each category of issue supports
 */
const ISSUE_CATEGORY_CAPABILITIES: Record<IssueCategory, IssueCategoryCapabilities> = {
  [IssueCategory.ERROR]: {
    delete: {enabled: true},
    deleteAndDiscard: {enabled: true},
    ignore: {enabled: true},
    merge: {enabled: true},
  },
  [IssueCategory.PERFORMANCE]: {
    delete: {
      enabled: false,
      text: t('Deleting is not yet supported for performance issues'),
    },
    deleteAndDiscard: {
      enabled: false,
      text: t('Deleting is not yet supported for performance issues'),
    },
    ignore: {enabled: true},
    merge: {
      enabled: false,
      text: t('Merging is not yet supported for performance issues'),
    },
  },
};

/**
 * Checks if an issue supports a specific capability.
 */
export function issueSupports(
  issueCategory: IssueCategory,
  capability: keyof IssueCategoryCapabilities
) {
  return ISSUE_CATEGORY_CAPABILITIES[issueCategory][capability] ?? {enabled: false};
}
