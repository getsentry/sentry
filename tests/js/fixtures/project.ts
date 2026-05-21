import {TeamFixture} from 'sentry-fixture/team';

import type {DetailedProject, Project} from 'sentry/types/project';

export function ProjectFixture(params: Partial<Project> = {}): Project {
  const team = TeamFixture();
  return {
    id: '2',
    slug: 'project-slug',
    name: 'Project Name',
    access: ['project:read'],
    hasAccess: true,
    isMember: true,
    isBookmarked: false,
    platforms: [],
    team,
    teams: [],
    environments: [],
    features: [],
    dateCreated: new Date().toISOString(),
    firstEvent: null,
    firstTransactionEvent: false,
    hasFeedbacks: false,
    hasNewFeedbacks: false,
    hasMinifiedStackTrace: false,
    hasProfiles: false,
    hasReplays: false,
    hasFlags: false,
    hasTraceMetrics: false,
    hasSessions: false,
    hasMonitors: false,
    hasLogs: false,
    hasInsightsHttp: false,
    hasInsightsDb: false,
    hasInsightsAssets: false,
    hasInsightsAppStart: false,
    hasInsightsScreenLoad: false,
    hasInsightsVitals: false,
    hasInsightsCaches: false,
    hasInsightsQueues: false,
    hasInsightsAgentMonitoring: false,
    hasInsightsMCP: false,
    ...params,
  };
}

export function DetailedProjectFixture(
  params: Partial<DetailedProject> = {}
): DetailedProject {
  return {
    ...ProjectFixture(params),
    organization: {id: '3', slug: 'org-slug'},
    plugins: [],
    processingIssues: 0,
    allowedDomains: ['*'],
    digestsMaxDelay: 0,
    digestsMinDelay: 0,
    dynamicSamplingBiases: null,
    groupingConfig: '',
    isInternal: false,
    relayPiiConfig: '',
    resolveAge: 0,
    safeFields: [],
    scrapeJavaScript: true,
    scrubIPAddresses: false,
    sensitiveFields: [],
    subjectTemplate: '',
    verifySSL: false,
    storeCrashReports: null,
    ...params,
  };
}
