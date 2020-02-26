import qs from 'query-string';

import {getExternal, getInternal} from 'app/views/discover/aggregations/utils';
import {getQueryStringFromQuery} from 'app/views/discover/utils';

export function getDiscoverUrlPathFromDiscoverQuery({organization, selection, query}) {
  const {
    datetime,
    environments, // eslint-disable-line no-unused-vars
    ...restSelection
  } = selection;

  // Discover does not support importing these
  const {
    groupby, // eslint-disable-line no-unused-vars
    rollup, // eslint-disable-line no-unused-vars
    name, // eslint-disable-line no-unused-vars
    orderby,
    ...restQuery
  } = query;

  const orderbyTimeIndex = orderby.indexOf('time');
  const visual = orderbyTimeIndex === -1 ? 'table' : 'line-by-day';

  const aggregations = query.aggregations.map(aggregation =>
    getExternal(getInternal(aggregation))
  );
  const [, , aggregationAlias] = (aggregations.length && aggregations[0]) || [];

  // Discover expects the aggregation aliases to be in a specific format
  restQuery.orderby = `${orderbyTimeIndex === 0 ? '' : '-'}${aggregationAlias || ''}`;
  restQuery.aggregations = aggregations;

  return `/organizations/${organization.slug}/discover/${getQueryStringFromQuery({
    ...restQuery,
    ...restSelection,
    start: datetime.start,
    end: datetime.end,
    range: datetime.period,
    limit: 1000,
  })}&visualization=${visual}`;
}

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
    const q = [];
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
