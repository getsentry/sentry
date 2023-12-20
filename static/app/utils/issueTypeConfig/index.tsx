import {t} from 'sentry/locale';
import {IssueCategory, IssueType, Project} from 'sentry/types';
import cronConfig from 'sentry/utils/issueTypeConfig/cronConfig';
import {
  errorConfig,
  getErrorHelpResource,
} from 'sentry/utils/issueTypeConfig/errorConfig';
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
    archiveUntilOccurrence: {enabled: true},
    delete: {enabled: false},
    deleteAndDiscard: {enabled: false},
    merge: {enabled: false},
    ignore: {enabled: false},
    resolveInRelease: {enabled: true},
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

/**
 * For some errors, we've written custom resources to help users understand
 * errors that may otherwise be difficult to debug. For example, common framework
 * errors that have no stack trace.
 */
export function shouldShowCustomErrorResourceConfig(
  params: GetConfigForIssueTypeParams,
  project: Project
): boolean {
  const isErrorIssue = 'issueType' in params && params.issueType === IssueType.ERROR;
  const hasTitle = 'title' in params && !!params.title;
  return (
    isErrorIssue && hasTitle && !!getErrorHelpResource({title: params.title!, project})
  );
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
export const getConfigForIssueType = (
  params: GetConfigForIssueTypeParams,
  project: Project
) => {
  const {issueCategory, issueType, title} =
    'eventOccurrenceType' in params
      ? getIssueCategoryAndTypeFromOccurrenceType(params.eventOccurrenceType as number)
      : params;

  const categoryMap = issueTypeConfig[issueCategory];

  if (!categoryMap) {
    return BASE_CONFIG;
  }

  const categoryConfig = categoryMap._categoryDefaults;
  const overrideConfig = issueType ? categoryMap[issueType] : {};
  const errorResourceConfig = shouldShowCustomErrorResourceConfig(params, project)
    ? getErrorHelpResource({title: title!, project})
    : null;

  return {
    ...BASE_CONFIG,
    ...categoryConfig,
    ...overrideConfig,
    ...errorResourceConfig,
  };
};
