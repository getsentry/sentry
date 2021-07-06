import {Project} from './project';

export function ProjectDetails(params) {
  return Project({
    subjectTemplate: '[$project] ${tag:level}: $title',
    subjectPrefix: '[my-org]',
    digestsMinDelay: 5,
    digestsMaxDelay: 60,
    dataScrubber: false,
    dataScrubberDefaults: false,
    scrubIPAddresses: false,
    resolveAge: 48,
    sensitiveFields: ['creditcard', 'ssn'],
    safeFields: ['business-email', 'company'],
    storeCrashReports: false,
    allowedDomains: ['example.com', 'https://example.com'],
    scrapeJavaScript: true,
    securityToken: 'security-token',
    securityTokenHeader: 'x-security-header',
    verifySSL: true,
    features: [],
    ...params,
  });
}
