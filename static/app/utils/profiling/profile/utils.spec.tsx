import {
  createContinuousProfileFrameIndex,
  createSentrySampleProfileFrameIndex,
  memoizeByReference,
} from './utils';

describe('createSentrySampleProfileFrameIndex', () => {
  it('dedupes frames', () => {
    const frames = [
      {
        in_app: true,
        function: 'foo',
        lineno: 100,
      },
      {
        in_app: true,
        function: 'bar',
        lineno: 105,
      },
      {
        in_app: true,
        function: 'foo',
        lineno: 100,
      },
    ];
    const frameIndex = createSentrySampleProfileFrameIndex(frames, 'javascript');

    expect(frameIndex).toEqual({
      0: frameIndex[0],
      1: frameIndex[1],
      2: frameIndex[0],
    });
  });
});

describe('createContinuousProfileFrameIndex', () => {
  it('qualifies java frame names with the module', () => {
    const index = createContinuousProfileFrameIndex(
      [
        {
          function: 'onCreate',
          module: 'com.example.MainActivity',
          platform: 'java',
          in_app: true,
        },
        {function: 'memcpy', module: 'libc.so', platform: 'native', in_app: false},
      ],
      'android'
    );

    expect(index[0]!.name).toBe('com.example.MainActivity.onCreate');
    expect(index[1]!.name).toBe('memcpy');
  });

  it('does not dedupe frames with the same function in different modules', () => {
    const index = createContinuousProfileFrameIndex(
      [
        {function: 'run', module: 'com.example.Foo', platform: 'java', in_app: true},
        {function: 'run', module: 'com.example.Bar', platform: 'java', in_app: true},
        {function: 'run', module: 'com.example.Foo', platform: 'java', in_app: true},
      ],
      'android'
    );

    expect(index[0]).not.toBe(index[1]);
    expect(index[0]).toBe(index[2]);
    expect(index[1]!.name).toBe('com.example.Bar.run');
  });
});

describe('memoizeByReference', () => {
  it('doesnt crash w/o args', () => {
    const spy = jest.fn().mockImplementation(() => 1);
    const fn = memoizeByReference(spy);

    // @ts-expect-error this shouldnt happen, but just in case it somehow gets passed
    // in during runtime, we want to eval the function every time. The reason
    // for doing so is that we dont know if it is pure or not.
    expect(() => fn()).not.toThrow();
    // @ts-expect-error this shouldnt happen, but in case it does
    expect(fn()).toBe(1);

    expect(spy).toHaveBeenCalledTimes(2);
  });
  it('memoizes when values match by reference', () => {
    const fn = jest.fn().mockImplementation(v => v);

    const val = Math.random();
    const memoized = memoizeByReference(fn);

    // @ts-expect-error we discard result of first call
    const _discard = memoized(val);
    const result = memoized(val);

    expect(result).toEqual(val);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-evaluates when values do not match by reference', () => {
    const fn = jest.fn().mockImplementation(v => v);

    const memoized = memoizeByReference(fn);

    // @ts-expect-error we discard result of first call
    const _discard = memoized(1);
    const result = memoized(2);

    expect(result).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
