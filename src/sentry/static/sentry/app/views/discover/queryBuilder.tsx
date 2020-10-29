import React from 'react';
import uniq from 'lodash/uniq';
import partition from 'lodash/partition';
import moment from 'moment-timezone';

import {Client} from 'app/api';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {t} from 'app/locale';
import {Project, Organization} from 'app/types';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {openModal} from 'app/actionCreators/modal';
import ConfigStore from 'app/stores/configStore';

import MissingProjectWarningModal from './missingProjectWarningModal';
import {COLUMNS, PROMOTED_TAGS, SPECIAL_TAGS, HIDDEN_TAGS} from './data';
import {isValidAggregation} from './aggregations/utils';
import {Aggregation, Column, Query, SnubaResult} from './types';

const API_LIMIT = 10000;

const DEFAULTS = {
  projects: [],
  fields: ['id', 'issue', 'project.name', 'platform', 'timestamp'],
  conditions: [],
  aggregations: [],
  orderby: '-timestamp',
  limit: 1000,
};

function applyDefaults(query: any) {
  Object.entries(DEFAULTS).forEach(([key, value]) => {
    if (!(key in query)) {
      query[key] = value;
    }
  });
  return query;
}

export interface QueryBuilder {
  load(): void;
  getInternal: () => any;
  getExternal: () => any;
  updateField: (field: string, value: any) => void;
  fetch: (data?: any, cursor?: string) => Promise<any>;
  fetchWithoutLimit: (data?: any) => Promise<any>;
  cancelRequests(): void;
  getQueryByType(originalQuery: any, type: string): Query;
  getColumns(): Column[];
  reset(q: any): void;
}

/**
 * This function is responsible for storing and managing updates to query state,
 * It applies sensible defaults if query parameters are not provided on
 * initialization.
 */
export default function createQueryBuilder(
  initial = {},
  organization: Organization,
  specificProjects?: Project[]
): QueryBuilder {
  const api = new Client();
  let query = applyDefaults(initial);

  if (!query.start && !query.end && !query.range) {
    query.range = DEFAULT_STATS_PERIOD;
  }

  const hasGlobalProjectAccess =
    ConfigStore.get('user').isSuperuser || organization.access.includes('org:admin');

  // TODO(lightweight-org): This needs to be refactored so that queries
  // do not depend on organization.projects
  const projectsToUse = specificProjects ?? organization.projects;
  const defaultProjects = projectsToUse.filter(projects =>
    hasGlobalProjectAccess ? projects.hasAccess : projects.isMember
  );

  const defaultProjectIds = getProjectIds(defaultProjects);

  const projectsToFetchTags = getProjectIds(
    hasGlobalProjectAccess ? projectsToUse : defaultProjects
  );

  const columns = COLUMNS.map(col => ({...col, isTag: false}));
  let tags: Column[] = [];

  return {
    getInternal,
    getExternal,
    updateField,
    fetch,
    fetchWithoutLimit,
    cancelRequests,
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
    type TagData = {
      tags_key: string;
    };

    return fetch({
      projects: projectsToFetchTags,
      fields: ['tags_key'],
      aggregations: [['count()', null, 'count']],
      orderby: '-count',
      range: '90d',
      turbo: true,
    })
      .then((res: SnubaResult) => {
        tags = res.data
          .filter((tag: TagData) => !HIDDEN_TAGS.includes(tag.tags_key))
          .map((tag: TagData) => {
            const type = SPECIAL_TAGS[tag.tags_key] || 'string';
            return {name: tag.tags_key, type, isTag: true};
          });
      })
      .catch(() => {
        tags = PROMOTED_TAGS.map((tag: string) => {
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
    const projects = query.projects.length ? query.projects : defaultProjectIds;

    // Default to DEFAULT_STATS_PERIOD when no date range selected (either relative or absolute)
    const {statsPeriod, start, end} = getParams({...query, statsPeriod: query.range});
    const hasAbsolute = start && end;
    const daterange = {
      ...(hasAbsolute && {start, end}),
      ...(statsPeriod && {range: statsPeriod}),
    };

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
      ...daterange,
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
  function updateField(field: string, value: any) {
    query[field] = value;

    // Ignore non valid aggregations (e.g. user halfway inputting data)
    const validAggregations = query.aggregations.filter((agg: Aggregation) =>
      isValidAggregation(agg, getColumns())
    );

    const orderbyField = (query.orderby || '').replace(/^-/, '');
    const hasOrderFieldInFields =
      getColumns().find(f => f.name === orderbyField) !== undefined;
    const hasOrderFieldInSelectedFields = query.fields.includes(orderbyField);
    const hasOrderFieldInAggregations = query.aggregations.some(
      (agg: Aggregation) => orderbyField === agg[2]
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

    const {start, end, statsPeriod} = getParams({...data, statsPeriod: data.range});

    if (start && end) {
      data.start = start;
      data.end = end;
    }

    if (statsPeriod) {
      data.range = statsPeriod;
    }

    return api
      .requestPromise(endpoint, {includeAllArgs: true, method: 'POST', data} as any)
      .then(([responseData, _, utils]) => {
        responseData.pageLinks = utils.getResponseHeader('Link');
        return responseData;
      })
      .catch(() => {
        throw new Error(t('An error occurred'));
      });
  }

  /**
   * Fetches either the query provided as an argument or the current query state
   * if this is not provided and returns the result wrapped in a promise
   *
   * This is similar to `fetch` but does not support pagination and mirrors the API limit
   *
   * @param {Object} [data] Optional field to provide data to fetch
   * @returns {Promise<Object|Error>}
   */
  function fetchWithoutLimit(data = getExternal()) {
    const endpoint = `/organizations/${organization.slug}/discover/query/`;

    // Reject immediately if no projects are available
    if (!data.projects.length) {
      return Promise.reject(new Error(t('No projects selected')));
    }

    if (typeof data.limit === 'number') {
      if (data.limit < 1 || data.limit > API_LIMIT) {
        return Promise.reject(new Error(t('Invalid limit parameter')));
      }
    }

    if (moment.utc(data.start).isAfter(moment.utc(data.end))) {
      return Promise.reject(new Error('Start date cannot be after end date'));
    }

    const {start, end, statsPeriod} = getParams({...data, statsPeriod: data.range});

    if (start && end) {
      data.start = start;
      data.end = end;
    }

    if (statsPeriod) {
      data.range = statsPeriod;
    }

    return api.requestPromise(endpoint, {method: 'POST', data} as any).catch(() => {
      throw new Error(t('Error with query'));
    });
  }

  /**
   * Cancels any in-flight API requests made via `fetch` or `fetchWithoutLimit`
   *
   * @returns {Void}
   */
  function cancelRequests() {
    api.clear();
  }

  /**
   * Get the actual query to be run for each visualization type
   *
   * @param {Object} originalQuery Original query input by user (external query representation)
   * @param {String} Type to fetch - currently either byDay or base
   * @returns {Object} Modified query to be run for that type
   */
  function getQueryByType(originalQuery: any, type: string): Query {
    if (type === 'byDayQuery') {
      return {
        ...originalQuery,
        groupby: ['time'],
        rollup: 60 * 60 * 24,
        orderby: '-time',
        limit: 5000,
      };
    }

    // If id or issue.id is present in query fields, always fetch the project.id
    // so we can generate links
    if (type === 'baseQuery') {
      return (originalQuery.fields || []).some(
        (field: string) => field === 'id' || field === 'issue.id'
      )
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
   * @param {Object} [q] optional query to reset to
   * @returns {Void}
   */
  function reset(q: any) {
    const [validProjects, invalidProjects] = partition(q.projects || [], project =>
      // -1 means all projects
      project === -1 ? true : defaultProjectIds.includes(project)
    );

    if (invalidProjects.length) {
      openModal((deps: any) => (
        <MissingProjectWarningModal
          organization={organization}
          validProjects={validProjects}
          invalidProjects={invalidProjects}
          {...deps}
        />
      ));
    }

    q.projects = validProjects;

    query = applyDefaults(q);
  }
}

function getProjectIds(projects: Project[]) {
  return projects.map(project => parseInt(project.id, 10));
}
