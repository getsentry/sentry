import {pick} from 'lodash';

import {ALL_VIEWS, SPECIAL_FIELDS} from './data';

/**
 * Given a view id, return the corresponding view object
 *
 * @param {String} requestedView
 * @returns {Object}
 *
 */
export function getCurrentView(requestedView) {
  return ALL_VIEWS.find(view => view.id === requestedView) || ALL_VIEWS[0];
}

/**
 * Takes a view and converts it into the format required for the events API
 *
 * @param {Object} view
 * @returns {Object}
 */
export function getQuery(view, location) {
  const fields = [];
  const aggregations = view.data.aggregations ? [...view.data.aggregations] : [];
  const groupby = view.data.groupby ? [...view.data.groupby] : [];

  view.data.fields.forEach(field => {
    if (SPECIAL_FIELDS.hasOwnProperty(field)) {
      const specialField = SPECIAL_FIELDS[field];

      if (specialField.hasOwnProperty('fields')) {
        fields.push(...specialField.fields);
      }
      if (specialField.hasOwnProperty('aggregations')) {
        aggregations.push(...specialField.aggregations);
      }
      if (specialField.hasOwnProperty('groupby')) {
        groupby.push(...specialField.groupby);
      }
    } else {
      fields.push(field);
    }
  });

  const data = pick(location.query, [
    'start',
    'end',
    'utc',
    'statsPeriod',
    'cursor',
    'query',
  ]);

  data.aggregation = aggregations;
  data.field = [...new Set(fields)];
  data.groupby = groupby;
  data.sort = view.data.sort;

  return data;
}
