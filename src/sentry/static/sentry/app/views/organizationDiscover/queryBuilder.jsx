import moment from 'moment-timezone';

import {COLUMNS} from './data';

const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss';

const DEFAULTS = {
  projects: [],
  fields: ['event_id', 'timestamp'],
  conditions: [],
  aggregations: [],
  start: moment()
    .subtract(14, 'days')
    .format(DATE_TIME_FORMAT),
  end: moment().format(DATE_TIME_FORMAT),
  orderby: '-event_id',
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
export default function createQueryBuilder(initial = {}, projectList) {
  const query = applyDefaults(initial);

  function getInternal() {
    return query;
  }

  function getExternal() {
    // Default to all projects if none is selected
    const projects = query.projects.length
      ? query.projects
      : projectList.map(project => parseInt(project.id, 10));

    // Default to all fields if there are none selected, and no aggregation or groupby is specified
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

    // If an aggregation is added, we need to remove the orderby parameter if it's not in the selected fields
    if (field === 'aggregations' && value.length > 0) {
      query.orderby = null;
      query.limit = null;
    }
  }

  function getFieldOptions() {
    return COLUMNS.map(({name}) => ({
      value: name,
      label: name,
    }));
  }

  function getOrderByOptions() {
    return COLUMNS.reduce((acc, {name}) => {
      return [
        ...acc,
        {value: name, label: `${name} asc`},
        {value: `-${name}`, label: `${name} desc`},
      ];
    }, []);
  }

  return {
    getInternal,
    getExternal,
    updateField,
    getFieldOptions,
    getOrderByOptions,
  };
}
