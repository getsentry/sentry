import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export const useIndexedSpan = (
  groupId: string,
  _referrer: string = 'use-indexed-span'
) => {
  const location = useLocation();

  const query = getQuery(groupId);
  const eventView = getEventView(groupId, location);

  // TODO: Add referrer
  const {isLoading, data} = useSpansQuery<IndexedSpan[]>({
    eventView,
    limit: 1,
    queryString: query,
    initialData: [],
    enabled: Boolean(query),
  });

  return {
    isLoading,
    data: data[0],
  };
};

function getQuery(groupId: string) {
  return `
    SELECT
    span_id as "id",
    group_id as "group",
    action,
    description,
    span_operation as "op",
    domain,
    module
    FROM spans_experimental_starfish
    WHERE group_id = '${groupId}'
    LIMIT 1
  `;
}

function getEventView(groupId: string, location: Location) {
  const cleanGroupID = groupId.replaceAll('-', '').slice(-16);

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: `group:${cleanGroupID}`,
      fields: ['group', 'action', 'description', 'domain', 'module', 'op'],
      dataset: DiscoverDatasets.SPANS_INDEXED,
      projects: [1],
      version: 2,
    },
    location
  );
}
