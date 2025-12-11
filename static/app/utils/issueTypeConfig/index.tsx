import {t} from 'sentry/locale';
import {IssueCategory, IssueType} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import aiDetectedConfig from 'sentry/utils/issueTypeConfig/aiDetectedConfig';
import cronConfig from 'sentry/utils/issueTypeConfig/cronConfig';
import dbQueryConfig from 'sentry/utils/issueTypeConfig/dbQueryConfig';
import {
  errorConfig,
  getErrorHelpResource,
} from 'sentry/utils/issueTypeConfig/errorConfig';
import feedbackConfig from 'sentry/utils/issueTypeConfig/feedbackConfig';
import frontendConfig from 'sentry/utils/issueTypeConfig/frontendConfig';
import httpClientConfig from 'sentry/utils/issueTypeConfig/httpClientConfig';
import metricConfig from 'sentry/utils/issueTypeConfig/metricConfig';
import metricIssueConfig from 'sentry/utils/issueTypeConfig/metricIssueConfig';
import mobileConfig from 'sentry/utils/issueTypeConfig/mobileConfig';
import outageConfig from 'sentry/utils/issueTypeConfig/outageConfig';
import performanceConfig from 'sentry/utils/issueTypeConfig/performanceConfig';
import preprodConfig from 'sentry/utils/issueTypeConfig/preprodConfig';
import replayConfig from 'sentry/utils/issueTypeConfig/replayConfig';
import type {
  IssueCategoryConfigMapping,
  IssueTypeConfig,
} from 'sentry/utils/issueTypeConfig/types';
import uptimeConfig from 'sentry/utils/issueTypeConfig/uptimeConfig';
import {Tab} from 'sentry/views/issueDetails/types';

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
    delete: {enabled: true},
    deleteAndDiscard: {enabled: false},
    merge: {enabled: false},
    ignore: {enabled: false},
    resolve: {enabled: true},
    resolveInRelease: {enabled: true},
    share: {enabled: false},
  },
  defaultTimePeriod: {sinceFirstSeen: true},
  header: {
    filterBar: {enabled: true, fixedEnvironment: false, searchBar: {enabled: true}},
    graph: {enabled: true, type: 'discover-events'},
    tagDistribution: {enabled: true},
    occurrenceSummary: {enabled: false},
  },
  customCopy: {
    resolution: t('Resolved'),
    eventUnits: t('Events'),
  },
  pages: {
    landingPage: Tab.DETAILS,
    events: {enabled: true},
    openPeriods: {enabled: false},
    checkIns: {enabled: false},
    uptimeChecks: {enabled: false},
    attachments: {enabled: false},
    userFeedback: {enabled: false},
    replays: {enabled: false},
    tagsTab: {enabled: true},
  },
  autofix: false,
  eventAndUserCounts: {enabled: true},
  detector: {enabled: false},
  logLevel: {enabled: false},
  mergedIssues: {enabled: false},
  performanceDurationRegression: {enabled: false},
  profilingDurationRegression: {enabled: false},
  regression: {enabled: false},
  showFeedbackWidget: false,
  similarIssues: {enabled: false},
  spanEvidence: {enabled: false},
  stacktrace: {enabled: true},
  stats: {enabled: true},
  tags: {enabled: true},
  discover: {enabled: true},
  evidence: {title: t('Evidence')},
  resources: null,
  usesIssuePlatform: true,
  issueSummary: {enabled: false},
  useOpenPeriodChecks: false,
  groupingInfo: {enabled: true},
};

const issueTypeConfig: Config = {
  [IssueCategory.ERROR]: errorConfig,
  [IssueCategory.PERFORMANCE]: performanceConfig,
  [IssueCategory.CRON]: cronConfig,
  [IssueCategory.REPLAY]: replayConfig,
  [IssueCategory.UPTIME]: uptimeConfig,
  [IssueCategory.METRIC_ALERT]: metricIssueConfig,
  [IssueCategory.OUTAGE]: outageConfig,
  [IssueCategory.FEEDBACK]: feedbackConfig,
  [IssueCategory.FRONTEND]: frontendConfig,
  [IssueCategory.HTTP_CLIENT]: httpClientConfig,
  [IssueCategory.DB_QUERY]: dbQueryConfig,
  [IssueCategory.MOBILE]: mobileConfig,
  [IssueCategory.METRIC]: metricConfig,
  [IssueCategory.AI_DETECTED]: aiDetectedConfig,
  [IssueCategory.PREPROD]: preprodConfig,
};

/**
 * For some errors, we've written custom resources to help users understand
 * errors that may otherwise be difficult to debug. For example, common framework
 * errors that have no stack trace.
 */
function shouldShowCustomErrorResourceConfig(
  params: GetConfigForIssueTypeParams,
  project: Project
): boolean {
  const isErrorIssue = 'issueType' in params && params.issueType === IssueType.ERROR;
  const isReplayHydrationIssue =
    'issueType' in params && params.issueType === IssueType.REPLAY_HYDRATION_ERROR;
  const hasTitle = 'title' in params && !!params.title;
  return (
    (isErrorIssue || isReplayHydrationIssue) &&
    hasTitle &&
    !!getErrorHelpResource({title: params.title!, project})
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
): IssueTypeConfig => {
  const {issueCategory, issueType, title} =
    'eventOccurrenceType' in params
      ? getIssueCategoryAndTypeFromOccurrenceType(params.eventOccurrenceType)
      : params;

  const refinedIssueType: IssueType | undefined = issueType?.replace(
    '_experimental',
    ''
  ) as IssueType | undefined;

  const categoryMap = issueTypeConfig[issueCategory];

  if (!categoryMap) {
    return BASE_CONFIG;
  }

  const categoryConfig = categoryMap._categoryDefaults;

  const overrideConfig = refinedIssueType ? categoryMap[refinedIssueType] : {};
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
