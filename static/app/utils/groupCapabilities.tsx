import {IssueCategory, IssueCategoryCapabilities} from 'sentry/types/group';

/**
 * Defines what capabilities each category of issue supports
 */
const ISSUE_CATEGORY_CAPABILITIES: Record<IssueCategory, IssueCategoryCapabilities> = {
  [IssueCategory.ERROR]: {
    delete: true,
    deleteAndDiscard: true,
    ignore: true,
    merge: true,
  },
  [IssueCategory.PERFORMANCE]: {
    delete: false,
    deleteAndDiscard: false,
    ignore: false,
    merge: false,
  },
};

/**
 * Checks if an issue supports a specific capability.
 */
export function issueSupports(
  issueCategory: IssueCategory,
  capability: keyof IssueCategoryCapabilities
) {
  return ISSUE_CATEGORY_CAPABILITIES[issueCategory][capability] ?? false;
}
