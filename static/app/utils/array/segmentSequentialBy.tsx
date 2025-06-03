type Predicate<T> = (datum: T) => boolean;

interface Partition<T> {
  data: T[];
  predicateValue: boolean;
}

/**
 * Partitions an array of items into groups based on a predicate function. Similar to Lodash `partition`, but creates multiple groups that respect the sequence of the original data.
 *
 * @param data - The array of items to partition.
 * @param predicate - A function to evaluate against each item.
 * @returns An array of partitions. Each partition has a `data` key that contains the items that satisfied the predicate, and a `predicateValue` key that indicates what the predicate returned for every item in the partition.
 */
export function segmentSequentialBy<T>(
  data: T[],
  predicate: Predicate<T>
): Array<Partition<T>> {
  if (!data.length) return [];

  const firstDatum: T = data.at(0)!;
  let previousPredicateValue = predicate(firstDatum);

  let previousPartition: Partition<T> = {
    predicateValue: previousPredicateValue,
    data: [firstDatum],
  };

  const partitions: Array<Partition<T>> = [previousPartition];

  for (const currentDatum of data.slice(1)) {
    const currentPredicateValue = predicate(currentDatum);

    if (currentPredicateValue === previousPredicateValue) {
      previousPartition.data.push(currentDatum);
    } else {
      previousPartition = {
        predicateValue: currentPredicateValue,
        data: [currentDatum],
      };

      partitions.push(previousPartition);
    }

    previousPredicateValue = currentPredicateValue;
  }

  return partitions;
}
