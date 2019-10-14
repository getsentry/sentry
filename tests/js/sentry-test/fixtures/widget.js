const DEFAULT_QUERIES = {
  discover: [
    {
      name: 'Known Users',
      fields: [],
      conditions: [['user.email', 'IS NOT NULL', null]],
      aggregations: [['uniq', 'user.email', 'Known Users']],
      limit: 1000,

      orderby: '-time',
      groupby: ['time'],
      rollup: 86400,
    },
    {
      name: 'Anonymous Users',
      fields: [],
      conditions: [['user.email', 'IS NULL', null]],
      aggregations: [['count()', null, 'Anonymous Users']],
      limit: 1000,

      orderby: '-time',
      groupby: ['time'],
      rollup: 86400,
    },
  ],
};

export function Widget(queries = {...DEFAULT_QUERIES}, options) {
  return {
    type: 'line',
    queries,
    title: 'Widget',
    ...options,
  };
}
