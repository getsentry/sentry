type ReleasesUrlParams = {
  appId?: string;
  query?: string;
  tab?: string;
  version?: string;
};

export function makeReleasesUrl(
  projectId: string | undefined,
  {appId, query, tab = 'mobile-builds', version}: ReleasesUrlParams = {}
): string {
  // Not knowing the projectId should be transient.
  if (projectId === undefined) {
    return '#';
  }

  const params = new URLSearchParams();
  params.set('project', projectId);
  params.set('tab', tab);

  const queries: string[] = [];
  if (query) {
    queries.push(query);
  }
  if (appId) {
    queries.push(`release.package:${appId}`);
  }
  if (version) {
    queries.push(`release.version:${version}`);
  }

  if (queries.length) {
    params.set('query', queries.join(' '));
  }

  return `/explore/releases/?${params}`;
}
