import {Client} from 'app/api';
import {doHealthRequest} from 'app/actionCreators/health';

describe('Health ActionCreator', function() {
  const api = new Client();
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  let mock;

  it('requests timeseries w/o tag', function() {
    mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/health/graph/',
    });
    doHealthRequest(api, {
      timeseries: true,
      organization,
      projects: [project.id],
      environments: [],
      topk: 5,
      includePrevious: true,
      period: '7d',
    });

    expect(mock).toHaveBeenCalled();

    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/health/graph/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: [project.id],
          environment: [],
          topk: 5,
          includePrevious: true,
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('requests timeseries w/ tag', function() {
    mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/health/graph/',
    });
    doHealthRequest(api, {
      timeseries: true,
      organization,
      projects: [project.id],
      environments: [],
      tag: 'release',
      topk: 5,
      includePrevious: true,
      period: '7d',
    });

    expect(mock).toHaveBeenCalled();

    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/health/graph/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: [project.id],
          environment: [],
          tag: 'release',
          topk: 5,
          includePrevious: true,
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('requests top', function() {
    mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/health/top/',
    });
    doHealthRequest(api, {
      timeseries: false,
      organization,
      projects: [project.id],
      environments: [],
      tag: 'release',
      includePrevious: false,
      period: '7d',
    });

    expect(mock).toHaveBeenCalled();
    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/health/top/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: [project.id],
          environment: [],
          tag: 'release',
          includePrevious: false,
          statsPeriod: '7d',
        }),
      })
    );
  });
});
