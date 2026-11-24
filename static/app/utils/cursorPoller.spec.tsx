import {RequestError} from './requestError/requestError';
import {CursorPoller} from './cursorPoller';

function makeRequestError(status: number) {
  const error = new RequestError(
    'GET',
    '/api/0/organizations/org-slug/issues/',
    new Error('Request failed')
  );
  error.status = status;
  return error;
}

describe('CursorPoller', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    try {
      jest.runOnlyPendingTimers();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the polling query string encoded', () => {
    const poller = new CursorPoller({
      linkPreviousHref:
        'https://sentry.io/api/0/organizations/org-slug/issues/?collapse=stats&query=is%3Aunresolved%20assigned%3A%23team&sort=recommended&cursor=0.5:0:1',
      success: jest.fn(),
    });

    expect(poller.pollingEndpoint).toBe(
      '/api/0/organizations/org-slug/issues/?query=is%3Aunresolved+assigned%3A%23team&sort=recommended&cursor=0.5%3A0%3A1'
    );
  });

  it('stops polling when the request is invalid', async () => {
    const poller = new CursorPoller({
      linkPreviousHref: '/api/0/organizations/org-slug/issues/?cursor=0.5:0:1',
      success: jest.fn(),
    });
    const request = jest
      .spyOn(poller.api, 'requestPromise')
      .mockRejectedValue(makeRequestError(400));

    poller.enable();
    await jest.advanceTimersByTimeAsync(3000);

    expect(request).toHaveBeenCalledTimes(1);
    expect(poller.active).toBe(false);

    await jest.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('backs off after server errors', async () => {
    const poller = new CursorPoller({
      linkPreviousHref: '/api/0/organizations/org-slug/issues/?cursor=0.5:0:1',
      success: jest.fn(),
    });
    jest.spyOn(poller.api, 'requestPromise').mockRejectedValue(makeRequestError(500));

    poller.enable();
    await jest.advanceTimersByTimeAsync(3000);

    expect(poller.active).toBe(true);
    expect(poller.getDelay()).toBe(6000);

    poller.disable();
  });
});
