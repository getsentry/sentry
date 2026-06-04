import {waitFor} from 'sentry-test/reactTestingLibrary';

import {doDiscoverQuery} from './genericDiscoverQuery';

describe('doDiscoverQuery', () => {
  const api = new MockApiClient();
  let eventsMock: any;
  beforeEach(() => {
    eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      status: 429,
      statusCode: 429,
    });
  });

  it('retries discover query when given retry options', async () => {
    await expect(
      doDiscoverQuery(
        api,
        '/organizations/org-slug/events/',
        {},
        {retry: {statusCodes: [429], tries: 3, baseTimeout: 0}}
      )
    ).rejects.toBeDefined();
    expect(eventsMock).toHaveBeenCalledTimes(3);
  });

  it('fails first discover query and then passes on the retry', async () => {
    const promise = doDiscoverQuery(
      api,
      '/organizations/org-slug/events/',
      {},
      {retry: {statusCodes: [429], tries: 3, baseTimeout: 10}}
    );
    await waitFor(() => {
      expect(eventsMock).toHaveBeenCalledTimes(1);
    });
    // update mock to be successful on second request
    eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      status: 200,
      statusCode: 200,
    });
    await expect(promise).resolves.toBeDefined();
    expect(eventsMock).toHaveBeenCalledTimes(1);
  });
});
