import {ProjectFixture} from 'sentry-fixture/project';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectErrorsBasicChart} from './projectErrorsBasicChart';

describe('ProjectErrorsBasicChart', () => {
  let projectsRequest: jest.Mock;

  beforeEach(() => {
    projectsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture()],
    });
  });

  it('writes the default period and drops start and end when the URL period is unsupported', async () => {
    const {router} = render(
      <ProjectErrorsBasicChart projectId="2" onTotalValuesChange={jest.fn()} />,
      {
        initialRouterConfig: {
          location: {
            pathname: '/projects/project-slug/',
            query: {
              statsPeriod: '90d',
              start: '2024-01-01',
              end: '2024-01-02',
              project: '2',
            },
          },
        },
      }
    );

    await waitFor(() =>
      expect(router.location.query).toEqual({statsPeriod: '14d', project: '2'})
    );
  });

  it('keeps the URL period when it is supported', async () => {
    const {router} = render(
      <ProjectErrorsBasicChart projectId="2" onTotalValuesChange={jest.fn()} />,
      {
        initialRouterConfig: {
          location: {pathname: '/projects/project-slug/', query: {statsPeriod: '7d'}},
        },
      }
    );

    await waitFor(() =>
      expect(projectsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/projects/',
        expect.objectContaining({query: {statsPeriod: '7d', query: 'id:2'}})
      )
    );
    expect(router.location.query).toEqual({statsPeriod: '7d'});
  });
});
