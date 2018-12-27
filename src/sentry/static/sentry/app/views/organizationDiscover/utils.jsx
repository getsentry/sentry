import {isValidAggregation} from './aggregations/utils';

export function getQueryFromQueryString(queryString) {
  if (!queryString) {
    return {};
  }
  let parsedQuery = queryString;
  let result = {};
  parsedQuery = parsedQuery.replace(/^\?|\/$/g, '').split('&');
  parsedQuery.forEach(item => {
    if (item.includes('=')) {
      let key = item.split('=')[0];
      let value = JSON.parse(decodeURIComponent(item.split('=')[1]));
      result[key] = value;
    }
  });

  return result;
}

export function getQueryStringFromQuery(query) {
  const queryProperties = Object.entries(query).map(([key, value]) => {
    return key + '=' + encodeURIComponent(JSON.stringify(value));
  });

  return `?${queryProperties.join('&')}`;
}

export function getOrderByOptions(queryBuilder) {
  const columns = queryBuilder.getColumns();
  const query = queryBuilder.getInternal();

  // If there are valid aggregations, only allow summarized fields and aggregations in orderby
  const validAggregations = query.aggregations.filter(agg =>
    isValidAggregation(agg, columns)
  );

  const hasAggregations = validAggregations.length > 0;

  const hasFields = query.fields.length > 0;

  const columnOptions = columns.reduce((acc, {name}) => {
    if (hasAggregations) {
      const isInvalidField = hasFields && !query.fields.includes(name);
      if (!hasFields || isInvalidField) {
        return acc;
      }
    }

    return [
      ...acc,
      {value: name, label: `${name} asc`},
      {value: `-${name}`, label: `${name} desc`},
    ];
  }, []);

  const aggregationOptions = [
    // Ensure aggregations are unique (since users might input duplicates)
    ...new Set(validAggregations.map(aggregation => aggregation[2])),
  ].reduce((acc, agg) => {
    return [
      ...acc,
      {value: agg, label: `${agg} asc`},
      {value: `-${agg}`, label: `${agg} desc`},
    ];
  }, []);

  return [...columnOptions, ...aggregationOptions];
}
