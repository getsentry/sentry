import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ProjectStats} from 'sentry/types/project';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useProjectStats} from 'sentry/views/projectsDashboard/useProjectStats';

describe('useProjectStats', () => {
  const organization = OrganizationFixture();
  const initialStats: ProjectStats = [[1517281200, 2]];
  const responseStats: ProjectStats = [
    [1517281200, 2],
    [1517310000, 1],
  ];

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('uses initial stats and batches missing project ids', async () => {
    const projects = [
      ProjectFixture({id: '1', slug: 'm'}),
      ProjectFixture({id: '2', slug: 'a'}),
      ProjectFixture({id: '3', slug: 'z'}),
    ];
    const projectWithInitialStats = {
      ...projects[0]!,
      stats: initialStats,
      transactionStats: initialStats,
    };

    const mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: projects.map(project => ({
        ...project,
        stats: responseStats,
        transactionStats: responseStats,
      })),
    });

    const {result} = renderHookWithProviders(
      () => useProjectStats({organization, hasPerformance: true}),
      {organization}
    );

    act(() => {
      expect(result.current.getOne(projectWithInitialStats).stats).toEqual(initialStats);
      result.current.getOne(projects[1]!);
      result.current.getOne(projects[2]!);
    });

    expect(mock).not.toHaveBeenCalled();

    await waitFor(() => expect(mock).toHaveBeenCalledTimes(1));
    expect(mock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: DiscoverDatasets.METRICS_ENHANCED,
          query: 'id:2 id:3',
          sessionStats: '1',
          statsPeriod: '24h',
          transactionStats: '1',
        }),
      })
    );

    await waitFor(() => {
      expect(result.current.getOne(projects[1]!).stats).toEqual(responseStats);
      expect(result.current.getOne(projects[2]!).stats).toEqual(responseStats);
    });
  });
});
