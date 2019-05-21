export function fetchOrganizationEvents(api, orgSlug, data) {
  return api.requestPromise(`/organizations/${orgSlug}/events/`, data);
}

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
 * Given a view id, return the corresponding view object
 *
 * @param {String} requestedView
 * @returns {Object}
 *
 */
export function getCurrentView(requestedView) {
  return ALL_VIEWS.find(view => view.id === requestedView) || ALL_VIEWS[0];
}
