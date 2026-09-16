import type {QueryClient} from '@tanstack/react-query';
import {queryOptions} from '@tanstack/react-query';

import type {Cell} from 'sentry/types/system';
import {apiFetch} from 'sentry/utils/api/apiFetch';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getCells} from 'sentry/utils/cells';

type CellRequest = (cell: Cell) => ApiQueryKey;

type CellOutcome<TData> = {cell: Cell} & PromiseSettledResult<TData>;

/**
 * Send the same request to every cell and report each cell's outcome. A
 * failing cell does not hide the answers of the others.
 */
export async function fetchFromAllCells<TData>(
  client: QueryClient,
  request: CellRequest
): Promise<Array<CellOutcome<TData>>> {
  const cells = getCells();
  const settled = await Promise.allSettled(
    cells.map(cell =>
      client
        .fetchQuery({queryKey: request(cell), queryFn: apiFetch<TData>, staleTime: 0})
        .then(response => response.json)
    )
  );
  return settled.map((outcome, index) => ({cell: cells[index]!, ...outcome}));
}

/**
 * Query options for a list endpoint fanned out over every cell, with all
 * cells' results merged into one list. IDs and slugs are unique across cells,
 * so a lookup by either matches in at most one cell. A failing cell is ignored
 * while another cell has results; otherwise its error surfaces.
 */
export function allCellsQueryOptions<TItem>(request: CellRequest, staleTime = 30_000) {
  return queryOptions({
    queryKey: ['all-cells', ...getCells().map(request)] as const,
    queryFn: async ({client}) => {
      const outcomes = await fetchFromAllCells<TItem[]>(client, request);
      const items = outcomes.flatMap(outcome =>
        outcome.status === 'fulfilled' ? outcome.value : []
      );
      const failure = outcomes.find(outcome => outcome.status === 'rejected');
      if (failure && items.length === 0) {
        throw failure.reason;
      }
      return items;
    },
    staleTime,
  });
}
