import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {OVERVIEW_PAGE_ALLOWED_OPS as BACKEND_OVERVIEW_PAGE_ALLOWED_OPS} from 'sentry/views/insights/pages/backend/settings';
import {
  DEFAULT_SPAN_OP_SELECTION,
  PAGE_SPAN_OPS,
  SPAN_OP_QUERY_PARAM,
  WEB_VITALS_OPS,
  type PageSpanOps,
} from 'sentry/views/insights/pages/frontend/settings';
import {categorizeProjects} from 'sentry/views/insights/pages/utils';

type Props = {
  includeWebVitalOps: boolean;
};

export function useFrontendQuery(
  {includeWebVitalOps}: Props = {
    includeWebVitalOps: false,
  }
) {
  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const location = useLocation();

  const {query: searchBarQuery} = useLocationQuery({
    fields: {
      query: decodeScalar,
    },
  });

  const spanOp: PageSpanOps = getSpanOpFromQuery(
    decodeScalar(location.query?.[SPAN_OP_QUERY_PARAM])
  );

  const query = new MutableSearch(searchBarQuery);

  const {frontendProjects} = categorizeProjects(
    getSelectedProjectList(selection.projects, projects)
  );

  // TODO - this query is getting complicated, once were on EAP, we should consider moving this to the backend
  query.addOp('(');

  if (spanOp === 'all') {
    const spanOps = includeWebVitalOps
      ? [...WEB_VITALS_OPS, 'navigation'] // web vitals ops includes pageload
      : ['pageload', 'navigation'];
    query.addFilterValue('span.op', `[${spanOps.join(',')}]`);
    // add disjunction filter creates a very long query as it seperates conditions with OR, project ids are numeric with no spaces, so we can use a comma seperated list
    if (frontendProjects.length > 0) {
      query.addOp('OR');
      query.addFilterValue(
        'project.id',
        `[${frontendProjects.map(({id}) => id).join(',')}]`
      );
    }
  } else if (spanOp === 'pageload') {
    const spanOps = includeWebVitalOps ? [...WEB_VITALS_OPS] : ['pageload'];
    query.addFilterValue('span.op', `[${spanOps.join(',')}]`);
  } else if (spanOp === 'navigation') {
    // navigation span ops doesn't work for web vitals, so we do need to filter for web vital spans
    query.addFilterValue('span.op', 'navigation');
  }

  query.addOp(')');

  if (spanOp === 'all') {
    query.addFilterValues('!span.op', BACKEND_OVERVIEW_PAGE_ALLOWED_OPS);
  }

  return query;
}

const isPageSpanOp = (op?: string): op is PageSpanOps => {
  return PAGE_SPAN_OPS.includes(op as PageSpanOps);
};

const getSpanOpFromQuery = (op?: string): PageSpanOps => {
  if (isPageSpanOp(op)) {
    return op;
  }
  return DEFAULT_SPAN_OP_SELECTION;
};
