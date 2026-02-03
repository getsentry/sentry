type ReleasesUrlParams = {
  query?: string;
  tab?: string;
};

export function makeReleasesUrl(
  organizationSlug: string,
  projectId: string | undefined,
  {query, tab = 'mobile-builds'}: ReleasesUrlParams = {}
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

  if (queries.length) {
    params.set('query', queries.join(' '));
  }

  return `/organizations/${organizationSlug}/explore/releases/?${params}`;
}
