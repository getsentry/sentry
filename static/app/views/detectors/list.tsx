import {useCallback} from 'react';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import ListLayout from 'sentry/components/workflowEngine/layout/list';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import DetectorListTable from 'sentry/views/detectors/components/detectorListTable';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {DETECTOR_LIST_PAGE_LIMIT} from 'sentry/views/detectors/constants';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';
import {useMonitorViewContext} from 'sentry/views/detectors/monitorViewContext';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';

const DETECTOR_TYPE_TITLE_MAPPING: Record<DetectorType, string> = {
  error: t('Error Monitors'),
  metric_issue: t('Metric Monitors'),
  monitor_check_in_failure: t('Cron Monitors'),
  uptime_domain_failure: t('Uptime Monitors'),
};

export default function DetectorsList() {
  useWorkflowEngineFeatureGate({redirect: true});

  const location = useLocation();
  const navigate = useNavigate();
  const {selection, isReady} = usePageFilters();
  const {detectorFilter, assigneeFilter} = useMonitorViewContext();

  const {
    sort: sorts,
    query,
    cursor,
  } = useLocationQuery({
    fields: {
      sort: decodeSorts,
      query: decodeScalar,
      cursor: decodeScalar,
    },
  });
  const sort = sorts[0] ?? {kind: 'desc', field: 'latestGroup'};

  // Build the query with detector type and assignee filters if provided
  // Map DetectorType values to query values (e.g., 'monitor_check_in_failure' -> 'cron')
  const typeFilterQuery = detectorFilter ? `type:${detectorFilter}` : undefined;
  const assigneeFilterQuery = assigneeFilter ? `assignee:${assigneeFilter}` : undefined;
  const finalQuery = [typeFilterQuery, assigneeFilterQuery, query]
    .filter(Boolean)
    .join(' ');

  const {
    data: detectors,
    isLoading,
    isError,
    isSuccess,
    getResponseHeader,
  } = useDetectorsQuery(
    {
      cursor,
      query: finalQuery,
      sortBy: sort ? `${sort?.kind === 'asc' ? '' : '-'}${sort?.field}` : undefined,
      projects: selection.projects,
      limit: DETECTOR_LIST_PAGE_LIMIT,
    },
    {enabled: isReady}
  );

  const hits = getResponseHeader?.('X-Hits') || '';
  const hitsInt = hits ? parseInt(hits, 10) || 0 : 0;
  // If maxHits is not set, we assume there is no max
  const maxHits = getResponseHeader?.('X-Max-Hits') || '';
  const maxHitsInt = maxHits ? parseInt(maxHits, 10) || Infinity : Infinity;

  const pageLinks = getResponseHeader?.('Link');

  const allResultsVisible = useCallback(() => {
    if (!pageLinks) {
      return false;
    }
    const links = parseLinkHeader(pageLinks);
    return links && !links.previous!.results && !links.next!.results;
  }, [pageLinks]);

  // Determine the page title based on active filters
  const pageTitle = detectorFilter
    ? DETECTOR_TYPE_TITLE_MAPPING[detectorFilter]
    : assigneeFilter === 'me'
      ? t('My Monitors')
      : t('Monitors');

  return (
    <SentryDocumentTitle title={pageTitle}>
      <PageFiltersContainer>
        <ListLayout actions={<Actions />} title={pageTitle}>
          <TableHeader />
          <div>
            <DetectorListTable
              detectors={detectors ?? []}
              isPending={isLoading}
              isError={isError}
              isSuccess={isSuccess}
              sort={sort}
              queryCount={hitsInt > maxHitsInt ? `${maxHits}+` : hits}
              allResultsVisible={allResultsVisible()}
            />
            <Pagination
              pageLinks={pageLinks}
              onCursor={newCursor => {
                navigate({
                  pathname: location.pathname,
                  query: {...location.query, cursor: newCursor},
                });
              }}
            />
          </div>
        </ListLayout>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function TableHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const {detectorFilter, assigneeFilter} = useMonitorViewContext();
  const query = typeof location.query.query === 'string' ? location.query.query : '';

  const onSearch = (searchQuery: string) => {
    navigate({
      pathname: location.pathname,
      query: {...location.query, query: searchQuery, cursor: undefined},
    });
  };

  // Exclude filter keys when they're set in context
  const excludeKeys = [detectorFilter && 'type', assigneeFilter && 'assignee'].filter(
    v => v !== undefined
  );

  return (
    <Flex gap="xl">
      <ProjectPageFilter />
      <div style={{flexGrow: 1}}>
        <DetectorSearch
          initialQuery={query}
          onSearch={onSearch}
          excludeKeys={excludeKeys}
        />
      </div>
    </Flex>
  );
}

function Actions() {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {monitorsLinkPrefix, detectorFilter} = useMonitorViewContext();

  // Pass the first selected project id that is not the all access project
  const project = selection.projects.find(pid => pid !== ALL_ACCESS_PROJECTS);

  // If detectorFilter is set, pass it as a query param to skip type selection
  const createPath = makeMonitorCreatePathname(organization.slug, monitorsLinkPrefix);

  const createQuery = detectorFilter
    ? {project, detectorType: detectorFilter}
    : {project};

  return (
    <Flex gap="sm">
      <MonitorFeedbackButton />
      <LinkButton
        to={{
          pathname: createPath,
          query: createQuery,
        }}
        priority="primary"
        icon={<IconAdd />}
        size="sm"
      >
        {t('Create Monitor')}
      </LinkButton>
    </Flex>
  );
}
