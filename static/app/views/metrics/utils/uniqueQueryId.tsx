export function* getUniqueQueryIdGenerator(
  usedIds: Set<number>
): Generator<number, number> {
  let id = 0;
  while (true) {
    while (usedIds.has(id)) {
      id++;
    }
    yield id++;
  }
}
