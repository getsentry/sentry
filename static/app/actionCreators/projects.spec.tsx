import {initializeOrg} from 'sentry-test/initializeOrg';

import {_debouncedLoadStats} from 'sentry/actionCreators/projects';

describe('Projects ActionCreators', function () {
  const api = new MockApiClient();
  const {organization, project} = initializeOrg();

  it('loadStatsForProject', function () {
    jest.useFakeTimers();
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
    });
    expect(mock).not.toHaveBeenCalled();

    _debouncedLoadStats(api, new Set([...Array(50)].map((_, i) => String(i))), {
      projectId: project.id,
      orgId: organization.slug,
    });

    expect(mock).toHaveBeenCalledTimes(5);
    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/projects/',
      expect.objectContaining({
        query: {
          statsPeriod: '24h',
          query: 'id:40 id:41 id:42 id:43 id:44 id:45 id:46 id:47 id:48 id:49',
        },
      })
    );
  });

  it('loadStatsForProject() with additional query', function () {
    jest.useFakeTimers();
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
    });
    expect(mock).not.toHaveBeenCalled();

    _debouncedLoadStats(api, new Set(['1', '2', '3']), {
      projectId: project.id,
      orgId: organization.slug,
      query: {transactionStats: '1'},
    });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/projects/',
      expect.objectContaining({
        query: {
          statsPeriod: '24h',
          query: 'id:1 id:2 id:3',
          transactionStats: '1',
        },
      })
    );
  });
});
