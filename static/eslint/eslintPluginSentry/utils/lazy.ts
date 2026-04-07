// eslint-disable-next-line @typescript-eslint/no-restricted-types
export function lazy<Value extends object, Args extends unknown[]>(
  getValue: (...args: Args) => Value
) {
  let value: Value | undefined;

  return (...args: Args) => {
    return (value ??= getValue(...args));
  };
}
