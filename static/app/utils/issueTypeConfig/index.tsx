import {t} from 'sentry/locale';
import {IssueCategory, IssueType} from 'sentry/types';
import errorConfig from 'sentry/utils/issueTypeConfig/errorConfig';
import performanceConfig from 'sentry/utils/issueTypeConfig/performanceConfig';
import profileConfig from 'sentry/utils/issueTypeConfig/profileConfig';
import {
  IssueCategoryConfigMapping,
  IssueTypeConfig,
} from 'sentry/utils/issueTypeConfig/types';

type Config = Record<IssueCategory, IssueCategoryConfigMapping>;

const BASE_CONFIG: IssueTypeConfig = {
  actions: {
    delete: {enabled: false},
    deleteAndDiscard: {enabled: false},
    merge: {enabled: false},
    ignore: {enabled: false},
    share: {enabled: false},
  },
  attachments: {enabled: false},
  grouping: {enabled: false},
  mergedIssues: {enabled: false},
  replays: {enabled: false},
  similarIssues: {enabled: false},
  userFeedback: {enabled: false},
  evidence: {title: t('Evidence')},
  resources: null,
};

const issueTypeConfig: Config = {
  [IssueCategory.ERROR]: errorConfig,
  [IssueCategory.PERFORMANCE]: performanceConfig,
  [IssueCategory.PROFILE]: profileConfig,
};

/**
 * Given an issue category and optional issue type, returns the corresponding config.
 * If an entry is not found in the issue type config, it looks in the default category
 * configuration. If not found there, it takes from the base config.
 */
export const getConfigForIssueType = ({
  issueCategory,
  issueType,
}: {
  issueCategory: IssueCategory;
  issueType?: IssueType;
}) => {
  const categoryMap = issueTypeConfig[issueCategory];

  if (!categoryMap) {
    return BASE_CONFIG;
  }

  const categoryConfig = categoryMap._categoryDefaults;
  const overrideConfig = issueType ? categoryMap[issueType] : {};

  return {
    ...BASE_CONFIG,
    ...categoryConfig,
    ...overrideConfig,
  };
};
