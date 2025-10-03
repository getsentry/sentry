import {Fragment, useCallback} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

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
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import DetectorListTable from 'sentry/views/detectors/components/detectorListTable';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {DETECTOR_LIST_PAGE_LIMIT} from 'sentry/views/detectors/constants';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';
import {useDetectorListSort} from 'sentry/views/detectors/utils/useDetectorListSort';

export default function DetectorsList() {
  useWorkflowEngineFeatureGate({redirect: true});
  const {selection, isReady} = usePageFilters();

  const [sort] = useDetectorListSort();
  const [query, setQuery] = useQueryState(
    'query',
    parseAsString.withDefault('').withOptions({
      history: 'push',
    })
  );
  const [cursor, setCursor] = useQueryState(
    'cursor',
    parseAsString.withOptions({history: 'push'})
  );

  const {
    data: detectors,
    isLoading,
    isError,
    isSuccess,
    getResponseHeader,
  } = useDetectorsQuery(
    {
      cursor: cursor ?? undefined,
      query,
      sortBy: sort ? `${sort.kind === 'asc' ? '' : '-'}${sort.field}` : undefined,
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
    <SentryDocumentTitle title={t('Monitors')} noSuffix>
      <PageFiltersContainer>
        <ListLayout actions={<Actions />}>
          <TableHeader query={query} setQuery={setQuery} />
          <div>
            <DetectorListTable
              detectors={detectors ?? []}
              isPending={isLoading}
              isError={isError}
              isSuccess={isSuccess}
              queryCount={hitsInt > maxHitsInt ? `${maxHits}+` : hits}
              allResultsVisible={allResultsVisible()}
            />
            <Pagination
              pageLinks={pageLinks}
              onCursor={newCursor => {
                setCursor(newCursor ?? null);
              }}
            />
          </div>
        </ListLayout>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function TableHeader({
  query,
  setQuery,
}: {
  query: string;
  setQuery: (query: string) => void;
}) {
  return (
    <Flex gap="xl">
      <ProjectPageFilter />
      <div style={{flexGrow: 1}}>
        <DetectorSearch initialQuery={query} onSearch={setQuery} />
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
    <Fragment>
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
    </Fragment>
  );
}
