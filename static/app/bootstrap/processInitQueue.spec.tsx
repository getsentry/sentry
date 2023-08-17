import {processInitQueue} from 'sentry/bootstrap/processInitQueue';

describe('processInitQueue', function () {
  it('processes queued up items', function () {
    const mock = jest.fn();
    const init = {
      name: 'onReady',
      onReady: mock,
    } as const;

    window.__onSentryInit = [init];

    processInitQueue();
    expect(mock).toHaveBeenCalledTimes(1);

    processInitQueue();
    expect(mock).toHaveBeenCalledTimes(1);

    window.__onSentryInit.push(init);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('is called after `processInitQueue` has already run', function () {
    processInitQueue();
    const mock = jest.fn();
    const init = {
      name: 'onReady',
      onReady: mock,
    } as const;

    window.__onSentryInit.push(init);
    expect(mock).toHaveBeenCalledTimes(1);

    processInitQueue();
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
