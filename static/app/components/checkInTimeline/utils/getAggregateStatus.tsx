import type {StatsBucket} from '../types';

export function getAggregateStatus<Status extends string>(
  statusPrecedent: Status[],
  stats: StatsBucket<Status>
) {
  return (
    statusPrecedent.toReversed().find(status => stats[status] > 0) ?? statusPrecedent[0]
  );
}
