type ArrayValue<A> = A extends readonly (infer T)[] ? T : never;
// as const will cast all properties to readonly
type RemoveReadOnly<T> = {-readonly [P in keyof T]: RemoveReadOnly<T[P]>};

type FromEntries<T> = T extends [infer Key, any][]
  ? {[K in Extract<Key, string>]: Extract<ArrayValue<T>, [K, any]>[1]}
  : {[key in string]: any};

function isIterable<T>(obj: any): obj is Iterable<T> {
  return typeof obj?.[Symbol.iterator] === 'function';
}

export function objectFromEntries<T>(entries: T): FromEntries<RemoveReadOnly<T>> {
  const target = {} as FromEntries<RemoveReadOnly<T>>;

  if (!isIterable<T>(entries)) {
    throw new TypeError(`Entries is not iterable, got ${JSON.stringify(entries)}`);
  }

  for (const entry of entries) {
    target[entry[0]] = entry[1];
  }

  return target;
}
