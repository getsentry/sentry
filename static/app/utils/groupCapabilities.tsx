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
    ignoreFor: {enabled: true},
    ignoreUntilReoccur: {enabled: true},
    ignoreUntilAffect: {enabled: true},
    merge: {enabled: true},
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
    ignore: {enabled: true},
    ignoreFor: {
      enabled: false,
      disabledReason: t(
        'Ignoring for a certain time period is not yet supported for performance issues'
      ),
    },
    ignoreUntilReoccur: {enabled: true},
    ignoreUntilAffect: {
      enabled: false,
      disabledReason: t(
        'Ignoring until the issue affects an additional number of users is not yet supported for performance issues'
      ),
    },

    merge: {
      enabled: false,
      disabledReason: t('Merging is not yet supported for performance issues'),
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
