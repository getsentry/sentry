import React from 'react';

import {deepFreeze} from 'app/utils';
import Link from 'app/components/links/link';

export const ALL_VIEWS = deepFreeze([
  {
    id: 'all',
    name: 'All Events',
    data: {
      query: '',
      fields: ['event', 'event.type', 'project.name', 'user', 'time'],
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
]);

/**
 * "Special fields" do not map 1:1 to an single column in the event database,
 * they are a UI concept that combines the results of multiple fields and
 * displays with a custom render function.
 */
export const SPECIAL_FIELDS = {
  event: {
    fields: ['title', 'id', 'project.id'],
    renderFunc: (data, org) => (
      <Link
        to={`/organizations/${org.slug}/projects/${data['project.name']}/events/${
          data.id
        }/`}
      >
        {data.title}
      </Link>
    ),
  },
  user: {
    fields: ['user.email', 'user.ip'],
    renderFunc: data => data['user.email'] || data['user.ip'],
  },
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
 * Takes a view and converts it into the format required for the events API
 *
 * @param {Object} view
 * @returns {Object}
 */
export function getQuery(view) {
  const data = {...view.data};
  const fields = data.fields.reduce((list, field) => {
    if (SPECIAL_FIELDS.hasOwnProperty(field)) {
      list.push(...SPECIAL_FIELDS[field].fields);
    } else {
      list.push(field);
    }
    return list;
  }, []);

  data.fields = [...new Set(fields)];

  return data;
}
