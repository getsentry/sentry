import * as qs from 'query-string';

export function getDiscover2UrlPathFromDiscoverQuery({
  organization,
  selection,
  query: d1Query,
}) {
  const d2Query = {
    name: d1Query.name,
    field: ['title', ...d1Query.fields],
    sort: d1Query.orderby,
    statsPeriod: selection?.datetime?.period,
    query: '',
  };

  const queryQueries = (d1Query.conditions || []).map(c => {
    const tag = c[0] || '';
    const val = c[2] || '';

    const operator = c[1] || '';
    const isNot = operator.includes('!') || operator.includes('NOT');
    const isNull = operator.includes('NULL');
    const isLike = operator.includes('LIKE') || operator.includes('*');
    const hasSpace = val.includes(' ');

    // Put condition into the columns
    if (!d2Query.field.includes(tag)) {
      d2Query.field.push(tag);
    }

    // Build the query
    const q = [] as string[];
    if (isNot) {
      q.push('!');
    }

    q.push(tag);
    q.push(':');

    // Quote open
    if (isNull || hasSpace) {
      q.push('"');
    }

    // Wildcard open
    if (isLike) {
      q.push('*');
    }

    q.push(val);

    // Wildcard close
    if (isLike) {
      q.push('*');
    }

    // Quote close
    if (isNull || hasSpace) {
      q.push('"');
    }

    return q.join('');
  });

  d2Query.field.push('count()');
  d2Query.query = queryQueries.join(' ');

  return `/organizations/${organization.slug}/discover/results/?${qs.stringify(d2Query)}`;
}
