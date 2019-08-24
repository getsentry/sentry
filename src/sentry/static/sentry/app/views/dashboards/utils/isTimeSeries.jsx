// Consider a query a time series if
export function isTimeSeries(query) {
  return query.groupby.includes('time');
}
