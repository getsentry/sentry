const BASE_URL = org => `/organizations/${org.slug}/health/`;

export const doHealthRequest = (
  api,
  {organization, projects, tag, environments, period, timeseries, includePrevious, topk}
) => {
  if (!api) return Promise.reject(new Error('API client not available'));

  const path = timeseries ? 'graph/' : 'top/';
  const query = {
    tag,
    includePrevious,
    statsPeriod: period,
    project: projects,
    ...(topk ? {topk} : {}),
  };

  return api.requestPromise(`${BASE_URL(organization)}${path}`, {
    query,
  });
};
