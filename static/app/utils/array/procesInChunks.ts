interface Props<T> {
  chunkSize: number;
  fn: (item: T) => Promise<unknown>;
  items: T[];
}

export async function processInChunks<T>({
  items,
  chunkSize,
  fn,
}: Props<T>): Promise<Array<PromiseSettledResult<unknown>>> {
  const results: Array<PromiseSettledResult<unknown>> = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.allSettled(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}
