describe('polyfills', () => {
  const methods = ['toSorted', 'toReversed', 'toSpliced', 'with', 'findLast'] as const;
  const originals = Object.fromEntries(
    methods.map(name => [name, Object.getOwnPropertyDescriptor(Array.prototype, name)])
  );

  afterEach(() => {
    for (const name of methods) {
      const descriptor = originals[name];
      if (descriptor) {
        // eslint-disable-next-line no-extend-native -- restore the native method
        Object.defineProperty(Array.prototype, name, descriptor);
      }
    }
  });

  it('installs ES2023 array methods when the engine lacks them', () => {
    for (const name of methods) {
      // Simulate an older engine (e.g. iOS 15 WebKit)
      delete (Array.prototype as any)[name];
    }
    expect((Array.prototype as any).toSorted).toBeUndefined();

    jest.isolateModules(() => {
      require('sentry/utils/polyfills');
    });

    const input = [3, 1, 2];
    expect(input.toSorted((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(input).toEqual([3, 1, 2]);
    expect(input.toReversed()).toEqual([2, 1, 3]);
    expect(input.toSpliced(0, 1)).toEqual([1, 2]);
    expect(input.with(0, 9)).toEqual([9, 1, 2]);
    expect(input.findLast(n => n > 1)).toBe(2);
  });
});
