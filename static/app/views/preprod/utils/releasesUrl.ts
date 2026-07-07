type ReleasesUrlParams = {
  display?: string;
  query?: string;
  tab?: string;
};

export function makeReleasesUrl(
  organizationSlug: string,
  projectId: string | undefined,
  {display, query, tab = 'mobile-builds'}: ReleasesUrlParams = {}
): string {
  const params = new URLSearchParams();
  if (projectId !== undefined) {
    params.set('project', projectId);
  }
  params.set('tab', tab);

  if (display) {
    params.set('display', display);
  }

  const queries: string[] = [];
  if (query) {
    queries.push(query);
  }

  if (queries.length) {
    params.set('query', queries.join(' '));
  }

  return `/organizations/${organizationSlug}/explore/releases/?${params}`;
}
