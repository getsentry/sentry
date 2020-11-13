import {Client} from 'app/api';
import {doEventsRequest} from 'app/actionCreators/events';

describe('Events ActionCreator', function () {
  const api = new Client();
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  const opts = {
    organization,
    project: [project.id],
    environment: [],
  };

  let mock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [
          [123, []],
          [123, []],
          [123, []],
          [123, []],
          [123, []],
          [123, []],
        ],
      },
    });
  });

  it('requests events stats with relative period', function () {
    doEventsRequest(api, {
      ...opts,
      includePrevious: false,
      period: '7d',
    });

    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: [project.id],
          environment: [],
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('requests events stats with relative period including previous period', function () {
    doEventsRequest(api, {
      ...opts,
      includePrevious: true,
      period: '7d',
    });

    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: [project.id],
          environment: [],
          statsPeriod: '14d',
        }),
      })
    );
  });

  it('requests events stats with absolute period', async function () {
    const start = new Date('2017-10-12T12:00:00.000Z');
    const end = new Date('2017-10-17T00:00:00.000Z');
    doEventsRequest(api, {
      ...opts,
      includePrevious: false,
      start,
      end,
    });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: [project.id],
          environment: [],
          start: '2017-10-12T12:00:00',
          end: '2017-10-17T00:00:00',
        }),
      })
    );
  });

  it('requests events stats with absolute period including previous period', async function () {
    const start = new Date('2017-10-12T12:00:00.000Z');
    const end = new Date('2017-10-17T00:00:00.000Z');
    await doEventsRequest(api, {
      ...opts,
      includePrevious: true,
      start,
      end,
    });

    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: [project.id],
          environment: [],
          start: '2017-10-08T00:00:00',
          end: '2017-10-17T00:00:00',
        }),
      })
    );
  });
});
