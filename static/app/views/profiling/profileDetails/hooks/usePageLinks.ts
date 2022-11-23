import {useMemo} from 'react';
import * as qs from 'query-string';

import {useLocation} from 'sentry/utils/useLocation';

const RESULTS_PER_PAGE = 50;

export function usePageLinks(
  data: any[],
  cursor: number,
  resultsPerPage = RESULTS_PER_PAGE
) {
  const location = useLocation();

  const pageLinks = useMemo(() => {
    const prevResults = cursor >= resultsPerPage ? 'true' : 'false';
    const prevCursor = cursor >= resultsPerPage ? cursor - resultsPerPage : 0;
    const prevQuery = {...location.query, cursor: prevCursor};
    const prevHref = `${location.pathname}${qs.stringify(prevQuery)}`;
    const prev = `<${prevHref}>; rel="previous"; results="${prevResults}"; cursor="${prevCursor}"`;

    const nextResults = cursor + resultsPerPage < data.length ? 'true' : 'false';
    const nextCursor =
      cursor + resultsPerPage < data.length ? cursor + resultsPerPage : 0;
    const nextQuery = {...location.query, cursor: nextCursor};
    const nextHref = `${location.pathname}${qs.stringify(nextQuery)}`;
    const next = `<${nextHref}>; rel="next"; results="${nextResults}"; cursor="${nextCursor}"`;

    return `${prev},${next}`;
  }, [cursor, location, data, resultsPerPage]);

  return pageLinks;
}
