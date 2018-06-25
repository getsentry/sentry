import moment from 'moment-timezone';

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
    if (!query.projects.length) {
      return {...query, projects: projectList.map(project => parseInt(project.id, 10))};
    } else {
      return query;
    }
  }

  function updateField(field, value) {
    query[field] = value;
  }

  return {
    getInternal,
    getExternal,
    updateField,
  };
}
