export default function defaultOverloaded(value?: number): number;
export default function defaultOverloaded(value = 15) {
  return value;
}
