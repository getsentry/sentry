import {PlatformExternalIssue as PlatformExternalIssueType} from 'sentry/types';

export function PlatformExternalIssue(
  params: Partial<PlatformExternalIssueType> = {}
): PlatformExternalIssueType {
  return {
    id: '1',
    serviceType: 'foo',
    displayName: 'project#1',
    webUrl: 'https://example.com/1',
    issueId: '',
    ...params,
  };
}
