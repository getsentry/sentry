import type {PlatformExternalIssue} from 'sentry/types/integrations';

export function PlatformExternalIssueFixture(
  params: Partial<PlatformExternalIssue> = {}
): PlatformExternalIssue {
  return {
    id: '1',
    serviceType: 'foo',
    displayName: 'project#1',
    webUrl: 'https://example.com/1',
    issueId: '',
    ...params,
  };
}
