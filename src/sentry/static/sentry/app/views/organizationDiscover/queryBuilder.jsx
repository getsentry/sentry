/*eslint no-use-before-define: ["error", { "functions": false }]*/

import moment from 'moment-timezone';

import {Client} from 'app/api';
import {t} from 'app/locale';
import {COLUMNS, PROMOTED_TAGS} from './data';
import {isValidAggregation} from './aggregations/utils';

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
 * It applies sensible defaults if query parameters are not provided on
 * initialization.
 */
export default function createQueryBuilder(initial = {}, organization) {
  let query = applyDefaults(initial);
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
    reset,
  };

  /**
   * Loads tags keys for user's projectsand updates `tags` with the result.
   * If the request fails updates `tags` to be the hardcoded list of predefined
   * promoted tags.
   *
   * @returns {Promise<Void>}
   */
  function load() {
    return fetch({
      projects: defaultProjects,
      fields: ['tags_key'],
      aggregations: [['count()', null, 'count']],
      orderby: '-count',
      start: moment()
        .subtract(90, 'days')
        .format(DATE_TIME_FORMAT),
      end: moment().format(DATE_TIME_FORMAT),
    })
      .then(res => {
        tags = res.data.map(tag => ({name: `tags[${tag.tags_key}]`, type: 'string'}));
      })
      .catch(err => {
        tags = PROMOTED_TAGS;
      });
  }

  /**
   * Returns the query object (internal state of the query)
   *
   * @returns {Object}
   */
  function getInternal() {
    return query;
  }

  /**
   * Returns the external representation of the query as required by Snuba.
   * Applies default projects and fields if these properties were not specified
   * by the user.
   *
   * @returns {Object}
   */
  function getExternal() {
    // Default to all projects if none is selected
    const projects = query.projects.length ? query.projects : defaultProjects;

    // Default to all fields if there are none selected, and no aggregation is
    // specified
    const useDefaultFields = !query.fields.length && !query.aggregations.length;

    const fields = useDefaultFields ? getColumns().map(({name}) => name) : query.fields;

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

  /**
   * Updates field in query to value provided. Also updates orderby and limit
   * parameters if this causes their values to become invalid.
   *
   * @param {String} field Name of field to be updated
   * @param {*} value Value to update field to
   * @returns {Void}
   */
  function updateField(field, value) {
    query[field] = value;

    // Ignore non valid aggregations (e.g. user halfway inputting data)
    const validAggregations = query.aggregations.filter(agg =>
      isValidAggregation(agg, getColumns())
    );

    const orderbyField = (query.orderby || '').replace(/^-/, '');
    const hasOrderFieldInFields =
      getColumns().find(f => f.name === orderbyField) !== undefined;
    const hasOrderFieldInSelectedFields = query.fields.includes(orderbyField);
    const hasOrderFieldInAggregations = query.aggregations.some(
      agg => orderbyField === agg[2]
    );

    const hasInvalidOrderbyField = validAggregations.length
      ? !hasOrderFieldInSelectedFields && !hasOrderFieldInAggregations
      : !hasOrderFieldInFields;

    // If orderby value becomes invalid, update it to the first valid aggregation
    if (hasInvalidOrderbyField) {
      if (validAggregations.length > 0) {
        query.orderby = validAggregations[0][2];
      } else {
        query.orderby = '-timestamp';
      }
    }

    // Snuba doesn't allow limit without orderby
    if (!query.orderby) {
      query.limit = null;
    }
  }

  /**
   * Fetches either the query provided as an argument or the current query state
   * if this is not provided and returns the result wrapped in a promise
   *
   * @param {Object} [data] Optional field to provide data to fetch
   * @returns {Promise<Object>}
   */
  function fetch(data) {
    const api = new Client();
    const endpoint = `/organizations/${organization.slug}/discover/`;

    data = data || getExternal();

    // Reject immediately if no projects are available
    if (!data.projects.length) {
      return Promise.reject(t('No projects selected'));
    }

    return api
      .requestPromise(endpoint, {
        method: 'POST',
        data,
      })
      .catch(() => {
        throw new Error(t('An error occurred'));
      });
  }

  /**
   * Returns all column objects, including tags
   *
   * @returns {Array<{name: String, type: String}>}
   */
  function getColumns() {
    return [...COLUMNS, ...tags];
  }

  /**
   * Resets the query to defaults
   *
   * @returns {Void}
   */
  function reset() {
    query = applyDefaults({});
  }
}
