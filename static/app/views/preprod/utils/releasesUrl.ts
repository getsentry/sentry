export function makeReleasesUrl(
  projectId: string | undefined,
  query: {appId?: string; version?: string}
): string {
  const {appId, version} = query;

  // Not knowing the projectId should be transient.
  if (projectId === undefined) {
    return '#';
  }

  const params = new URLSearchParams();
  params.set('project', projectId);
  const parts = [];
  if (appId) {
    parts.push(`release.package:${appId}`);
  }
  if (version) {
    parts.push(`release.version:${version}`);
  }
  if (parts.length) {
    params.set('query', parts.join(' '));
  }
  return `/explore/releases/?${params}`;
}
