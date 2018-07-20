import {Client} from 'app/api';
import {doHealthRequest} from 'app/actionCreators/health';

describe('Health ActionCreator', function() {
  const api = new Client();
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  let mock;

  it('requests timeseries', function() {
    mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/health/graph/',
    });
    doHealthRequest(api, {
      timeseries: true,
      organization,
      projects: [project],
      environments: [],
      tag: 'release',
      topk: 5,
    });

    expect(mock).toHaveBeenCalled();

    expect(mock.mock.calls[0][1].query).toMatchSnapshot();
  });

  it('requests top', function() {
    mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/health/top/',
    });
    doHealthRequest(api, {
      timeseries: false,
      organization,
      projects: [project],
      environments: [],
      tag: 'release',
      topk: 5,
    });

    expect(mock).toHaveBeenCalled();

    expect(mock.mock.calls[0][1].query).toMatchSnapshot();
  });
});
