export const CLUSTERS = {
  top: {
    name: 'top',
    condition: '',
    grouping_column: "module IN ['db', 'http'] ? module : 'other' AS primary_group",
    clusters: {
      db: {
        name: 'db',
        condition: "WHERE module == 'db'",
      },
      http: {
        name: 'http',
        condition: "WHERE module == 'http'",
        grouping_column:
          "span_operation == 'http.client' ? 'client' : 'server' AS primary_group",
        clusters: {
          client: {
            name: 'client',
            condition: "WHERE span_operation == 'http.client'",
          },
          server: {
            name: 'server',
            condition: "WHERE span_operation == 'http.server'",
          },
        },
      },
      other: {
        name: 'other',
        condition: "WHERE module NOT IN ['http', 'db']",
        clusters: {},
      },
    },
  },
};
