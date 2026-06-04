interface Props<Item, Result> {
  chunkSize: number;
  fn: (item: Item) => Promise<Result>;
  items: Item[];
}

export async function processInChunks<Item, Result>({
  items,
  chunkSize,
  fn,
}: Props<Item, Result>): Promise<Array<PromiseSettledResult<Result>>> {
  const results: Array<PromiseSettledResult<Result>> = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.allSettled(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}
