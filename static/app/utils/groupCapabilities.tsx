import {t} from 'sentry/locale';
import type {IssueCategoryCapabilities} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';

/**
 * Defines what capabilities each category of issue supports
 */
const ISSUE_CATEGORY_CAPABILITIES: Record<IssueCategory, IssueCategoryCapabilities> = {
  [IssueCategory.ERROR]: {
    delete: {enabled: true},
    deleteAndDiscard: {enabled: true},
    merge: {enabled: true},
    ignore: {enabled: true},
    share: {enabled: true},
    codeowners: {enabled: true},

    // Tabs
    userFeedback: {enabled: true},
    attachments: {enabled: true},
    mergedIssues: {enabled: true},
    grouping: {enabled: true},
    similarIssues: {enabled: true},
    replays: {enabled: true},
  },
  [IssueCategory.PERFORMANCE]: {
    delete: {
      enabled: false,
      disabledReason: t('Not yet supported for performance issues'),
    },
    deleteAndDiscard: {
      enabled: false,
      disabledReason: t('Not yet supported for performance issues'),
    },
    merge: {
      enabled: false,
      disabledReason: t('Not yet supported for performance issues'),
    },
    ignore: {enabled: true},
    share: {enabled: true},
    codeowners: {
      enabled: false,
      disabledReason: t('Codeowners do not apply to performance issues'),
    },

    // Tabs
    userFeedback: {enabled: false},
    attachments: {enabled: false},
    mergedIssues: {enabled: false},
    grouping: {enabled: false},
    similarIssues: {enabled: false},
    replays: {enabled: false},
  },
};

/**
 * Checks if an issue supports a specific capability.
 */
export function getIssueCapability(
  issueCategory: IssueCategory,
  capability: keyof IssueCategoryCapabilities
) {
  return ISSUE_CATEGORY_CAPABILITIES[issueCategory]?.[capability] ?? {enabled: false};
}
