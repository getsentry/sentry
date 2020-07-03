/**
 * Generate a URL to the events page for a discover query that
 * contains a condition.
 *
 * @param {Object} query The discover query object
 * @param {String[]} values A list of strings that represent field values
 *   e.g. if the query has multiple fields (browser, device), values could be ["Chrome", "iPhone"]
 * @return {String} Returns a url to the "events" page with any discover conditions tranformed to search query syntax
 */
import zipWith from 'lodash/zipWith';

import {OPERATOR} from 'app/views/discover/data';
import {escapeQuotes} from 'app/components/events/interfaces/utils';
import {Organization, GlobalSelection} from 'app/types';
import {Condition, Query} from 'app/views/discover/types';

import {getEventsUrlPathFromDiscoverQuery} from './getEventsUrlPathFromDiscoverQuery';

type Props = {
  values: string[];
  organization: Organization;
  selection: GlobalSelection;
  query: Query;
};

export function getEventsUrlFromDiscoverQueryWithConditions({
  values,
  query,
  selection,
  organization,
}: Props) {
  return getEventsUrlPathFromDiscoverQuery({
    organization,
    selection,
    query: {
      ...query,
      conditions: [
        ...query.conditions,
        // For each `field`, create a condition that joins it with each `rowObject.name` value (separated by commas)
        // e.g. fields: ['browser', 'device'],  rowObject.name: "Chrome, iPhone"
        //      ----> [['browser', '=', 'Chrome'], ['device', '=', 'iPhone']]
        ...zipWith(
          query.fields,
          values,
          (field, value) =>
            [
              field,
              OPERATOR.EQUAL,
              value === null ? '""' : `"${escapeQuotes(value)}"`,
            ] as Condition
        ),
      ],
    },
  });
}
