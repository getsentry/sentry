import {getOrStartTracingSession} from './tracingSessionIntegration';

describe('tracingSessionIntegration', () => {
  beforeEach(() => {
    // @ts-expect-error
    delete window.sessionStorage;
  });
  it.each([
    ['undefined'][JSON.stringify('}')],
    [JSON.stringify({id: '123', started_at: ''})],
    [JSON.stringify({id: '', started_at: Date.now()})],
  ])('starts invalid session when storage is in a broken state', session => {
    Object.defineProperty(window, 'sessionStorage', {
      writable: true,
      value: {
        getItem() {
          return session;
        },
      },
    });

    expect(getOrStartTracingSession()).toEqual({
      id: expect.any(String),
      started_at: expect.any(Number),
    });
  });

  it('handles session storage throwing', () => {
    Object.defineProperty(window, 'sessionStorage', {
      writable: true,
      value: {
        getItem() {
          throw new Error('dead');
        },
      },
    });

    expect(getOrStartTracingSession()).toEqual({
      id: expect.any(String),
      started_at: expect.any(Number),
    });
  });

  it('starts new session after expiry time', () => {
    // 2 hours past expiry date
    const YESTERDAY = Date.now() - 24 * 2 * 60 * 60 * 1000;
    Object.defineProperty(window, 'sessionStorage', {
      writable: true,
      value: {
        getItem() {
          return JSON.stringify({
            id: '123',
            started_at: YESTERDAY,
          });
        },
      },
    });

    const session = getOrStartTracingSession();
    expect(session.started_at).toBeGreaterThan(YESTERDAY);
    expect(session).toEqual({
      id: expect.any(String),
      started_at: expect.any(Number),
    });
  });
});
