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

  it('does not retry discover query by default', async () => {
    await expect(
      doDiscoverQuery(api, '/organizations/org-slug/events/', {})
    ).rejects.toBeDefined();
    expect(eventsMock).toHaveBeenCalledTimes(1);
  });
});
