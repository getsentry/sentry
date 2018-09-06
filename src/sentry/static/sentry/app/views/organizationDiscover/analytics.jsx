import analytics from 'app/utils/analytics';

export function trackQuery(organization, query) {
  const data = {
    org_id: parseInt(organization.id, 10),
    projects: query.projects,
    fields: query.fields,
    conditions: query.conditions,
    aggregations: query.aggregations,
    orderby: query.orderby,
  };

  if (typeof query.limit === 'number') {
    data.limit = query.limit;
  }

  analytics('discover.query', data);
}
