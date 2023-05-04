export const CLUSTERS = {
  top: {
    name: 'top',
    label: 'All',
    condition: '',
    grouping_column: "module IN ['db', 'http'] ? concat('top.',  module) : 'top.other'",
    clusters: ['top.db', 'top.http', 'top.other'],
  },
  'top.db': {
    name: 'top.db',
    label: 'DB',
    condition: "module == 'db'",
  },
  'top.http': {
    name: 'top.http',
    label: 'HTTP',
    condition: "module == 'http'",
    grouping_column: 'span_operation',
    clusters: ['http.client', 'http.server'],
  },
  'top.other': {
    name: 'top.other',
    label: 'Other',
    condition: "module NOT IN ['http', 'db']",
  },
  'http.client': {
    name: 'http.client',
    label: 'Client',
    condition: "span_operation == 'http.client'",
    grouping_column:
      "action IN ['GET', 'POST'] ? concat('http.client.', lower(action)) : 'http.client.other'",
    clusters: ['http.client.get', 'http.client.post', 'http.client.other'],
  },
  'http.client.get': {
    name: 'http.client.get',
    label: 'GET',
    condition: "action == 'GET'",
  },
  'http.client.post': {
    name: 'http.client.post',
    label: 'POST',
    condition: "action == 'POST'",
  },
  'http.client.other': {
    name: 'http.client.other',
    label: 'Other',
    condition: "action NOT IN ['GET', 'POST']",
  },
  'http.server': {
    name: 'http.server',
    label: 'Server',
    condition: "span_operation == 'http.server'",
  },
};
