/*eslint no-use-before-define: ["error", { "functions": false }]*/

import moment from 'moment-timezone';

import {Client} from 'app/api';
import {COLUMNS, PROMOTED_TAGS} from './data';

const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss';

const DEFAULTS = {
  projects: [],
  fields: [],
  conditions: [],
  aggregations: [],
  start: moment()
    .subtract(14, 'days')
    .format(DATE_TIME_FORMAT),
  end: moment().format(DATE_TIME_FORMAT),
  orderby: '-timestamp',
  limit: 1000,
};

function applyDefaults(query) {
  Object.entries(DEFAULTS).forEach(([key, value]) => {
    if (!(key in query)) {
      query[key] = value;
    }
  });
  return query;
}

/**
 * This function is responsible for storing and managing updates to query state,
 * It applies sensible defaults if query parameters are not provided on initialization.
 */
export default function createQueryBuilder(initial = {}, organization) {
  const query = applyDefaults(initial);
  const defaultProjects = organization.projects
    .filter(projects => projects.isMember)
    .map(project => parseInt(project.id, 10));
  let tags = [];

  return {
    getInternal,
    getExternal,
    updateField,
    fetch,
    getColumns,
    load,
  };

  function load() {
    return fetch({
      projects: defaultProjects,
      aggregations: [['topK(1000)', 'tags_key', 'tags_key']],
      start: moment()
        .subtract(90, 'days')
        .format(DATE_TIME_FORMAT),
      end: moment().format(DATE_TIME_FORMAT),
    })
      .then(res => {
        tags = res.data[0].tags_key.map(tag => ({name: tag, type: 'string'}));
      })
      .catch(err => {
        tags = PROMOTED_TAGS;
      });
  }

  function getInternal() {
    return query;
  }

  function getExternal() {
    // Default to all projects if none is selected
    const projects = query.projects.length ? query.projects : defaultProjects;

    // Default to all fields if there are none selected, and no aggregation is specified
    const useDefaultFields =
      !query.fields.length && !query.aggregations.length && !query.groupby;

    const fields = useDefaultFields ? COLUMNS.map(({name}) => name) : query.fields;

    // Remove orderby property if it is not set
    if (!query.orderby) {
      delete query.orderby;
    }

    return {
      ...query,
      projects,
      fields,
    };
  }

  function updateField(field, value) {
    query[field] = value;

    // If there are aggregations, we need to remove or update the orderby parameter
    // if it's not in the list of selected fields
    const hasAggregations = query.aggregations.length > 0;
    const hasFields = query.fields.length > 0;
    const orderbyField = (query.orderby || '').replace(/^-/, '');
    const hasOrderFieldInFields = query.fields.includes(orderbyField);

    if (hasAggregations) {
      // Check for invalid order by parameter
      if (hasFields && !hasOrderFieldInFields) {
        query.orderby = query.fields ? query.fields[0] : null;
      }

      // Disable orderby for aggregations without any summarize fields
      if (!hasFields) {
        query.orderby = null;
      }
    }

    if (!query.orderby) {
      query.limit = null;
    }
  }

  function fetch(data) {
    const api = new Client();
    const endpoint = `/organizations/${organization.slug}/discover/`;

    return api.requestPromise(endpoint, {
      method: 'POST',
      data: data || getExternal(),
    });
  }

  // Get all columns, including tags
  function getColumns() {
    return [...COLUMNS, ...tags];
  }
}
