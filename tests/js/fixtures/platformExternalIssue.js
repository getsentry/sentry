export function PlatformExternalIssue(params = {}) {
  return {
    groupId: 1,
    serviceType: 'foo',
    displayName: 'project#1',
    webUrl: 'https://example.com/1',
    ...params,
  };
}
