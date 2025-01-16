import {getPreloadedDataPromise} from './getPreloadedData';

describe('getPreloadedDataPromise', () => {
  beforeEach(() => {
    window.__sentry_preload = {
      orgSlug: 'slug',
    };
  });
  it('should register fallback promise', async () => {
    const fallback = jest.fn(() => Promise.resolve('fallback'));
    const result = await getPreloadedDataPromise('name', 'slug', fallback);
    expect(result).toBe('fallback');
    expect((window as any).__sentry_preload.name_fallback).toBeInstanceOf(Promise);
  });
  it('should only call fallback on failure', async () => {
    (window as any).__sentry_preload.name = Promise.resolve('success');
    const fallback = jest.fn();
    const result = await getPreloadedDataPromise('name', 'slug', fallback, true);
    expect(result).toBe('success');
    expect(fallback).not.toHaveBeenCalled();
  });
});
