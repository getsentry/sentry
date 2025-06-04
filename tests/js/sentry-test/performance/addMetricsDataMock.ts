export function addMetricsDataMock(settings?: {
  metricsCount: number;
  nullCount: number;
  unparamCount: number;
  compatibleProjects?: number[];
  dynamicSampledProjects?: number[];
}) {
  const compatible_projects = settings?.compatibleProjects ?? [];
  const metricsCount = settings?.metricsCount ?? 10;
  const unparamCount = settings?.unparamCount ?? 0;
  const nullCount = settings?.nullCount ?? 0;
  const dynamic_sampling_projects = settings?.dynamicSampledProjects ?? [1];

  MockApiClient.addMockResponse({
    method: 'GET',
    url: `/organizations/org-slug/metrics-compatibility/`,
    body: {
      compatible_projects,
      dynamic_sampling_projects,
    },
  });

  MockApiClient.addMockResponse({
    method: 'GET',
    url: `/organizations/org-slug/metrics-compatibility-sums/`,
    body: {
      sum: {
        metrics: metricsCount,
        metrics_unparam: unparamCount,
        metrics_null: nullCount,
      },
    },
  });

  MockApiClient.addMockResponse({
    method: 'GET',
    url: `/organizations/org-slug/events/`,
    body: {
      data: [{}],
      meta: {},
    },
  });
}
