export default function toArray<T>(val: T | T[]) {
  return Array.isArray(val) ? val : [val];
}
