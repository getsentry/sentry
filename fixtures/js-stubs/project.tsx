import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import type {Project} from 'sentry/types/project';

export function ProjectFixture(params: Partial<Project> = {}): Project {
  const team = TeamFixture();
  return {
    id: '2',
    slug: 'project-slug',
    name: 'Project Name',
    access: ['project:read'],
    allowedDomains: ['*'],
    hasAccess: true,
    isMember: true,
    isBookmarked: false,
    team,
    teams: [],
    environments: [],
    features: [],
    eventProcessing: {
      symbolicationDegraded: false,
    },
    dateCreated: new Date().toISOString(),
    digestsMaxDelay: 0,
    digestsMinDelay: 0,
    dynamicSamplingBiases: null,
    firstEvent: null,
    firstTransactionEvent: false,
    groupingAutoUpdate: false,
    groupingConfig: '',
    hasCustomMetrics: false,
    hasFeedbacks: false,
    hasNewFeedbacks: false,
    hasMinifiedStackTrace: false,
    hasProfiles: false,
    hasReplays: false,
    hasSessions: false,
    hasMonitors: false,
    isInternal: false,
    organization: OrganizationFixture(),
    plugins: [],
    processingIssues: 0,
    relayPiiConfig: '',
    resolveAge: 0,
    safeFields: [],
    scrapeJavaScript: true,
    scrubIPAddresses: false,
    sensitiveFields: [],
    subjectTemplate: '',
    verifySSL: false,
    ...params,
  };
}
