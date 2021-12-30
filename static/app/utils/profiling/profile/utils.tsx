import {Frame} from 'sentry/utils/profiling/frame';

export function createFrameIndex(
  frames: Profiling.RawProfileBase['shared']['frames'],
  trace?: JSSelfProfiling.Trace
): Record<string | number, Frame> {
  return frames.reduce((acc, frame, index) => {
    acc[index] = new Frame({
      key: index,
      resource:
        trace && typeof frame.resource === 'number'
          ? trace.resources[frame.resource]
          : undefined,
      ...frame,
    });
    return acc;
  }, {});
}

type Cache<Arguments extends ReadonlyArray<any> | any, Value> = {
  args: Arguments;
  value: Value;
};

export function memoizeByReference<Arguments, Value>(
  fn: (args: Arguments) => Value
): (t: Arguments) => Value {
  let cache: Cache<Arguments, Value> | null = null;

  return function memoizeByReferenceCallback(args: Arguments) {
    // If this is the first run then eval the fn and cache the result
    if (!cache) {
      cache = {args, value: fn(args)};
      return cache.value;
    }
    // If args match by reference, then return cached value
    if (cache.args === args && cache.args !== undefined && args !== undefined) {
      return cache.value;
    }

    // Else eval the fn and store the new value
    cache.args = args;
    cache.value = fn(args);
    return cache.value;
  };
}

export function memoizeVariadicByReference<Arguments, Value>(
  fn: (...args: ReadonlyArray<Arguments>) => Value
): (...t: ReadonlyArray<Arguments>) => Value {
  let cache: Cache<ReadonlyArray<Arguments>, Value> | null = null;

  return function memoizeByReferenceCallback(...args: ReadonlyArray<Arguments>) {
    // If this is the first run then eval the fn and cache the result
    if (!cache) {
      cache = {args, value: fn(...args)};
      return cache.value;
    }
    // If args match by reference, then return cached value
    if (
      cache.args.length === args.length &&
      cache.args.length !== 0 &&
      args.length !== 0 &&
      args.every((arg, i) => arg === cache?.args[i])
    ) {
      return cache.value;
    }

    // Else eval the fn and store the new value
    cache.args = args;
    cache.value = fn(...args);
    return cache.value;
  };
}
