import {t} from 'sentry/locale';
import {IssueCategory, IssueType} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import cronConfig from 'sentry/utils/issueTypeConfig/cronConfig';
import {
  errorConfig,
  getErrorHelpResource,
} from 'sentry/utils/issueTypeConfig/errorConfig';
import metricIssueConfig from 'sentry/utils/issueTypeConfig/metricIssueConfig';
import performanceConfig from 'sentry/utils/issueTypeConfig/performanceConfig';
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
    delete: {enabled: false},
    deleteAndDiscard: {enabled: false},
    merge: {enabled: false},
    ignore: {enabled: false},
    resolve: {enabled: true},
    resolveInRelease: {enabled: true},
    share: {enabled: false},
  },
  header: {
    filterBar: {enabled: true, fixedEnvironment: false},
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
};

const issueTypeConfig: Config = {
  [IssueCategory.ERROR]: errorConfig,
  [IssueCategory.PERFORMANCE]: performanceConfig,
  [IssueCategory.CRON]: cronConfig,
  [IssueCategory.REPLAY]: replayConfig,
  [IssueCategory.UPTIME]: uptimeConfig,
  [IssueCategory.METRIC_ALERT]: metricIssueConfig,
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
