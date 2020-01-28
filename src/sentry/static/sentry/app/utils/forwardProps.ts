function forwardProps<T extends {}, K extends keyof T>(
  object: T,
  allowedKeys: Array<K>
): K {
  const keys = (Object.keys(object) as any) as Array<K>;
  return keys
    .filter(key => allowedKeys.includes(key))
    .reduce((obj: any, key) => {
      obj[key] = object[key];
      return obj;
    }, {});
}
export default forwardProps;
