import {getPreloadedDataPromise} from './getPreloadedData';

describe('getPreloadedDataPromise', () => {
  beforeEach(() => {
    window.__sentry_preload = {
      orgSlug: 'slug',
    };
  });
  it('should register fallback promise', async () => {
    const fallback = jest.fn(() => Promise.resolve('fallback'));
    const result = await getPreloadedDataPromise('organization', 'slug', fallback as any);
    expect(result).toBe('fallback');
    expect(window.__sentry_preload!.organization_fallback).toBeInstanceOf(Promise);
  });
  it('should only call fallback on failure', async () => {
    window.__sentry_preload!.organization = Promise.resolve('success') as any;
    const fallback = jest.fn();
    const result = await getPreloadedDataPromise('organization', 'slug', fallback, true);
    expect(result).toBe('success');
    expect(fallback).not.toHaveBeenCalled();
  });
});
