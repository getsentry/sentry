import {Organization} from 'sentry-fixture/organization';
import {Team} from 'sentry-fixture/team';

import type {Project as TProject} from 'sentry/types';

export function Project(params: Partial<TProject> = {}): TProject {
  const team = Team();
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
    hasFeedbacks: false,
    hasNewFeedbacks: false,
    hasMinifiedStackTrace: false,
    hasProfiles: false,
    hasReplays: false,
    hasSessions: false,
    isInternal: false,
    organization: Organization(),
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
