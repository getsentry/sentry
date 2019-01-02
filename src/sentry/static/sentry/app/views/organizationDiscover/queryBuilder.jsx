/*eslint no-use-before-define: ["error", { "functions": false }]*/
import React from 'react';
import {uniq} from 'lodash';
import moment from 'moment-timezone';

import {Client} from 'app/api';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {t} from 'app/locale';

import {openModal} from 'app/actionCreators/modal';

import MissingProjectWarningModal from './missingProjectWarningModal';
import {COLUMNS, PROMOTED_TAGS, SPECIAL_TAGS} from './data';
import {isValidAggregation} from './aggregations/utils';

const DEFAULTS = {
  projects: [],
  fields: ['id', 'issue.id', 'project.name', 'platform', 'timestamp'],
  conditions: [],
  aggregations: [],
  range: DEFAULT_STATS_PERIOD,
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
  const columns = COLUMNS.map(col => ({...col, isTag: false}));
  let tags = [];

  return {
    getInternal,
    getExternal,
    updateField,
    fetch,
    getQueryByType,
    getColumns,
    load,
    reset,
  };

  /**
   * Loads tags keys for user's projects and updates `tags` with the result.
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
      range: '90d',
      turbo: true,
    })
      .then(res => {
        tags = res.data.map(tag => {
          const type = SPECIAL_TAGS[tags.tags_key] || 'string';
          return {name: tag.tags_key, type, isTag: true};
        });
      })
      .catch(err => {
        tags = PROMOTED_TAGS.map(tag => {
          const type = SPECIAL_TAGS[tag] || 'string';
          return {name: tag, type, isTag: true};
        });
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
        query.orderby = `-${validAggregations[0][2]}`;
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
   * @returns {Promise<Object|Error>}
   */
  function fetch(data = getExternal(), cursor = '0:0:1') {
    const api = new Client();
    const limit = data.limit || 1000;
    const endpoint = `/organizations/${organization.slug}/discover/query/?per_page=${limit}&cursor=${cursor}`;

    // Reject immediately if no projects are available
    if (!data.projects.length) {
      return Promise.reject(new Error(t('No projects selected')));
    }

    if (typeof data.limit === 'number') {
      if (data.limit < 1 || data.limit > 1000) {
        return Promise.reject(new Error(t('Invalid limit parameter')));
      }
    }

    if (moment.utc(data.start).isAfter(moment.utc(data.end))) {
      return Promise.reject(new Error('Start date cannot be after end date'));
    }

    return api
      .requestPromise(endpoint, {includeAllArgs: true, method: 'POST', data})
      .then(([responseData, _, utils]) => {
        responseData.pageLinks = utils.getResponseHeader('Link');
        return responseData;
      })
      .catch(err => {
        throw new Error(t('An error occurred'));
      });
  }

  /**
   * Get the actual query to be run for each visualization type
   *
   * @param {Object} originalQuery Original query input by user (external query representation)
   * @param {String} Type to fetch - currently either byDay or base
   * @returns {Object} Modified query to be run for that type
   */
  function getQueryByType(originalQuery, type) {
    if (type === 'byDayQuery') {
      return {
        ...originalQuery,
        groupby: ['time'],
        rollup: 60 * 60 * 24,
        orderby: '-time',
        limit: 1000,
      };
    }

    // If id or issue.id is present in query fields, always fetch the project.id
    // so we can generate links
    if (type === 'baseQuery') {
      return originalQuery.fields.some(field => field === 'id' || field === 'issue.id')
        ? {
            ...originalQuery,
            fields: uniq([...originalQuery.fields, 'project.id']),
          }
        : originalQuery;
    }

    throw new Error('Invalid query type');
  }

  /**
   * Returns all column objects, including tags
   *
   * @returns {Array<{name: String, type: String}>}
   */
  function getColumns() {
    return [...columns, ...tags];
  }

  /**
   * Resets the query to defaults or the query provided
   * Displays a warning if user does not have access to any project in the query
   *
   * @returns {Void}
   */
  function reset(q = {}) {
    const invalidProjects = (q.projects || []).filter(
      project => !defaultProjects.includes(project)
    );

    if (invalidProjects.length) {
      openModal(deps => (
        <MissingProjectWarningModal
          organization={organization}
          projects={invalidProjects}
          {...deps}
        />
      ));
    }

    query = applyDefaults(q);
  }
}
