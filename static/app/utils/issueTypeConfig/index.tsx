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

type IssueCategoryAndType = {
  issueCategory: IssueCategory;
  issueType?: IssueType;
};

type GetConfigForIssueTypeParams = {eventOccurrenceType: number} | IssueCategoryAndType;

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
  usesIssuePlatform: true,
};

const issueTypeConfig: Config = {
  [IssueCategory.ERROR]: errorConfig,
  [IssueCategory.PERFORMANCE]: performanceConfig,
  [IssueCategory.PROFILE]: profileConfig,
};

const eventOccurrenceTypeToIssueCategory = (eventOccurrenceType: number) => {
  if (eventOccurrenceType >= 2000) {
    return IssueCategory.PROFILE;
  }
  if (eventOccurrenceType >= 1000) {
    return IssueCategory.PERFORMANCE;
  }
  return IssueCategory.ERROR;
};

export const getIssueCategoryAndTypeFromOccurrenceType = (
  eventOccurrenceType: number
): IssueCategoryAndType => {
  return {
    issueCategory: eventOccurrenceTypeToIssueCategory(eventOccurrenceType),
  };
};

/**
 * Given an issue category and optional issue type, returns the corresponding config.
 * If an entry is not found in the issue type config, it looks in the default category
 * configuration. If not found there, it takes from the base config.
 */
export const getConfigForIssueType = (params: GetConfigForIssueTypeParams) => {
  const {issueCategory, issueType} =
    'eventOccurrenceType' in params
      ? getIssueCategoryAndTypeFromOccurrenceType(params.eventOccurrenceType)
      : params;

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
