export type Cluster = {
  condition: (value: any) => string;
  label: string;
  name: string;
  description_label?: string;
  domain_label?: string;
  grouping_column?: string;
  grouping_condition?: (value: any) => () => string;
  isDynamic?: boolean;
  value?: string;
};

export const CLUSTERS: Record<string, Cluster> = {
  top: {
    name: 'top',
    label: 'All',
    condition: () => '',
    grouping_column: "module IN ['db', 'http'] ? concat('top.',  module) : 'top.other'",
  },
  'top.db': {
    name: 'top.db',
    label: 'DB',
    description_label: 'Query',
    domain_label: 'Table',
    condition: () => "module == 'db'",
    grouping_column:
      "action IN ['SELECT', 'INSERT'] ? concat('db.',  lower(action)) : 'db.other'",
  },
  'db.select': {
    name: 'db.select',
    label: 'SELECT',
    condition: () => "action == 'SELECT'",
  },
  'db.insert': {
    name: 'db.insert',
    label: 'INSERT',
    condition: () => "action == 'INSERT'",
  },
  'db.other': {
    name: 'db.other',
    label: 'Other',
    condition: () => "action NOT IN ['SELECT', 'INSERT']",
    grouping_column: 'action',
    grouping_condition: value => () => `action == '${value}'`,
  },
  'top.http': {
    name: 'top.http',
    label: 'HTTP',
    description_label: 'URL',
    domain_label: 'Host',
    condition: () => "module == 'http'",
    grouping_column: "concat('http.client.',  lower(action))",
  },
  'top.other': {
    name: 'top.other',
    label: 'Other',
    condition: () => "module NOT IN ['http', 'db']",
    grouping_column: "splitByChar('.', span_operation)[1]",
    grouping_condition: value => () => `splitByChar('.', span_operation)[1] = '${value}'`,
  },
  'http.client.get': {
    name: 'http.client.get',
    label: 'GET',
    condition: () => "action == 'GET'",
    grouping_column: 'domain',
    grouping_condition: value => () => `domain = '${value}'`,
  },
  'http.client.post': {
    name: 'http.client.post',
    label: 'POST',
    condition: () => "action == 'POST'",
  },
  'http.client.other': {
    name: 'http.client.other',
    label: 'Other',
    condition: () => "action NOT IN ['GET', 'POST']",
  },
};
