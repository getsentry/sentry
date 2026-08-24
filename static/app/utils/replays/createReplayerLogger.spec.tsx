import {createReplayerLogger} from 'sentry/utils/replays/createReplayerLogger';

describe('createReplayerLogger', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('forwards warnings while under the limit', () => {
    const logger = createReplayerLogger(3);

    logger.warn('first');
    logger.warn('second');
    logger.warn('third');

    expect(warnSpy).toHaveBeenCalledTimes(3);
    expect(warnSpy).toHaveBeenNthCalledWith(1, 'first');
    expect(warnSpy).toHaveBeenNthCalledWith(3, 'third');
  });

  it('warns once about suppression when the limit is exceeded', () => {
    const logger = createReplayerLogger(2);

    logger.warn('first');
    logger.warn('second');
    logger.warn('third');
    logger.warn('fourth');

    expect(warnSpy).toHaveBeenCalledTimes(3);
    expect(warnSpy).toHaveBeenLastCalledWith(
      '[replay] Suppressing further rrweb warnings after 2.'
    );
  });

  it('drops every warning past the suppression notice', () => {
    const logger = createReplayerLogger(1);

    for (let i = 0; i < 100; i++) {
      logger.warn('noisy', {mutation: 'payload'});
    }

    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
