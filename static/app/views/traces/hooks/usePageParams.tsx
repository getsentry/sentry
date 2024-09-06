import {useMemo} from 'react';

import {decodeList, decodeScalar} from 'sentry/utils/queryString';

export function usePageParams(location) {
  const queries = useMemo(() => {
    return decodeList(location.query.query);
  }, [location.query.query]);

  const metricsMax = decodeScalar(location.query.metricsMax);
  const metricsMin = decodeScalar(location.query.metricsMin);
  const metricsOp = decodeScalar(location.query.metricsOp);
  const metricsQuery = decodeScalar(location.query.metricsQuery);
  const mri = decodeScalar(location.query.mri);

  return {
    queries,
    metricsMax,
    metricsMin,
    metricsOp,
    metricsQuery,
    mri,
  };
}
