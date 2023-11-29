import {t} from 'sentry/locale';
import {ErrorTitles, IssueCategory, IssueType} from 'sentry/types';
import cronConfig from 'sentry/utils/issueTypeConfig/cronConfig';
import {errorConfig, titleResourceMap} from 'sentry/utils/issueTypeConfig/errorConfig';
import performanceConfig from 'sentry/utils/issueTypeConfig/performanceConfig';
import {
  IssueCategoryConfigMapping,
  IssueTypeConfig,
} from 'sentry/utils/issueTypeConfig/types';

type Config = Record<IssueCategory, IssueCategoryConfigMapping>;

type IssueCategoryAndType = {
  issueCategory: IssueCategory;
  issueType?: IssueType;
  title?: string;
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
  events: {enabled: true},
  mergedIssues: {enabled: false},
  regression: {enabled: false},
  replays: {enabled: false},
  stats: {enabled: true},
  similarIssues: {enabled: false},
  tags: {enabled: true},
  userFeedback: {enabled: false},
  discover: {enabled: true},
  evidence: {title: t('Evidence')},
  resources: null,
  usesIssuePlatform: true,
};

const issueTypeConfig: Config = {
  [IssueCategory.ERROR]: errorConfig,
  [IssueCategory.PERFORMANCE]: performanceConfig,
  [IssueCategory.PROFILE]: performanceConfig,
  [IssueCategory.CRON]: cronConfig,
};

function getErrorResourceConfig(title: string) {
  let errorTitle = '';

  if (title.includes('ChunkLoadError')) {
    errorTitle = ErrorTitles.CHUNK_LOAD_ERROR;
  }
  const resource = titleResourceMap[errorTitle];
  return resource ?? {};
}

const eventOccurrenceTypeToIssueCategory = (eventOccurrenceType: number) => {
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
  const {issueCategory, issueType, title} =
    'eventOccurrenceType' in params
      ? getIssueCategoryAndTypeFromOccurrenceType(params.eventOccurrenceType)
      : params;

  const categoryMap = issueTypeConfig[issueCategory];

  if (!categoryMap) {
    return BASE_CONFIG;
  }

  const categoryConfig = categoryMap._categoryDefaults;
  const overrideConfig = issueType ? categoryMap[issueType] : {};
  const errorResourceConfig =
    issueType === IssueType.ERROR && title ? getErrorResourceConfig(title) : {};

  return {
    ...BASE_CONFIG,
    ...categoryConfig,
    ...overrideConfig,
    ...errorResourceConfig,
  };
};
