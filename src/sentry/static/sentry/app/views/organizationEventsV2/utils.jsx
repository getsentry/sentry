import {cloneDeep} from 'lodash';

export const ALL_VIEWS = [
  {
    id: 'all',
    name: 'All Events',
    data: {
      query: '',
      fields: ['title', 'event.type', 'project.name', 'user.email', 'time'],
      groupBy: [],
      aggregations: [],
      sort: '',
    },
    tags: [
      'event.type',
      'release',
      'project.name',
      'user.email',
      'user.ip',
      'environment',
    ],
  },
  {
    id: 'errors',
    name: 'Errors',
    data: {
      query: '',
      fields: ['project.name', 'fingerprint', 'count', 'user_count'],
      groupBy: ['count', 'user_count', 'project.name'],
      aggregations: [['count', null, 'count'], ['count', 'user', 'user_count']],
      sort: '',
    },
    tags: ['error.type', 'project.name'],
  },
  {
    id: 'csp',
    name: 'CSP',
    data: {
      query: '',
      fields: ['project.name', 'count', 'user_count'],
      groupBy: ['count', 'user_count', 'project.name'],
      aggregations: [['count', null, 'count'], ['count', 'user', 'user_count']],
      sort: '',
    },
    tags: [
      'project.name',
      'blocked-uri',
      'browser.name',
      'os.name',
      'effective-directive',
    ],
  },
];

/**
 * "Special fields" do not map 1:1 to an single column in the event database,
 * they are a UI concept that combines the results of multiple fields and
 * displays with some custom formatting. This map lists the underlying data
 * that we need to fetch in order to populate each of these special field.
 */
const SPECIAL_FIELDS = {
  event: ['id', 'title'],
  user: ['user.email', 'user.ip'],
};

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
 * Fetch organization events given view object
 *
 * @param {Object} api
 * @param {String} orgSlug
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export function fetchOrganizationEvents(api, orgSlug, view) {
  const query = getQuery(view);
  return api.requestPromise(`/organizations/${orgSlug}/events/`, {
    query,
  });
}

/**
 * Takes a view and converts it into the format required for the events API
 *
 * @param {Object} view
 * @returns {Object}
 */
export function getQuery(view) {
  const data = cloneDeep(view.data);
  data.fields = data.fields.reduce((fields, field) => {
    if (SPECIAL_FIELDS.hasOwnProperty(field)) {
      fields.push(...SPECIAL_FIELDS[field]);
    } else {
      fields.push(field);
    }
    return fields;
  }, []);
  return data;
}
