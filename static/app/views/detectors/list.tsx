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
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';

export default function DetectorsList() {
  useWorkflowEngineFeatureGate({redirect: true});

  const location = useLocation();
  const navigate = useNavigate();
  const {selection, isReady} = usePageFilters();

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

  const {
    data: detectors,
    isLoading,
    isError,
    isSuccess,
    getResponseHeader,
  } = useDetectorsQuery(
    {
      cursor,
      query,
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

  return (
    <SentryDocumentTitle title={t('Monitors')}>
      <PageFiltersContainer>
        <ListLayout actions={<Actions />}>
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
  const query = typeof location.query.query === 'string' ? location.query.query : '';

  const onSearch = (searchQuery: string) => {
    navigate({
      pathname: location.pathname,
      query: {...location.query, query: searchQuery, cursor: undefined},
    });
  };

  return (
    <Flex gap="xl">
      <ProjectPageFilter />
      <div style={{flexGrow: 1}}>
        <DetectorSearch initialQuery={query} onSearch={onSearch} />
      </div>
    </Flex>
  );
}

function Actions() {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  let project: number | undefined;
  if (selection.projects) {
    // Find the first selected project id that is not the all access project
    project = selection.projects.find(pid => pid !== ALL_ACCESS_PROJECTS);
  }

  return (
    <Flex gap="sm">
      <MonitorFeedbackButton />
      <LinkButton
        to={{
          pathname: makeMonitorCreatePathname(organization.slug),
          query: project ? {project} : undefined,
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
