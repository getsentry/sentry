import {useCallback} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
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
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import DetectorListTable from 'sentry/views/detectors/components/detectorListTable';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {DETECTOR_LIST_PAGE_LIMIT} from 'sentry/views/detectors/constants';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';
import {useMonitorViewContext} from 'sentry/views/detectors/monitorViewContext';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';
import {useDetectorListSort} from 'sentry/views/detectors/utils/useDetectorListSort';

interface DetectorHeadingInfo {
  description: string;
  docsUrl: string;
  title: string;
}

const DETECTOR_TYPE_HEADING_MAPPING: Record<
  Exclude<DetectorType, 'issue_stream'>,
  DetectorHeadingInfo
> = {
  error: {
    title: t('Error Monitors'),
    description: t(
      'Error monitors are created by default for each project based on issue grouping/fingerprint rules.'
    ),
    docsUrl: 'https://docs.sentry.io/product/monitors/',
  },
  metric_issue: {
    title: t('Metric Monitors'),
    description: t(
      'Metric monitors track errors based on span attributes and custom metrics.'
    ),
    docsUrl: 'https://docs.sentry.io/product/monitors/',
  },
  monitor_check_in_failure: {
    title: t('Cron Monitors'),
    description: t(
      'Cron monitors check in on recurring jobs and tell you if they’re running on schedule, failing, or succeeding.'
    ),
    docsUrl: 'https://docs.sentry.io/product/crons/',
  },
  uptime_domain_failure: {
    title: t('Uptime Monitors'),
    description: t(
      'Uptime monitors continuously track configured URLs, delivering alerts and insights to quickly identify downtime and troubleshoot issues.'
    ),
    docsUrl: 'https://docs.sentry.io/product/alerts/uptime-monitoring/',
  },
};

export default function DetectorsList() {
  useWorkflowEngineFeatureGate({redirect: true});
  const {selection, isReady} = usePageFilters();
  const {detectorFilter, assigneeFilter, emptyState} = useMonitorViewContext();

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
      cursor: cursor ?? undefined,
      query: finalQuery,
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

  // Determine the page heading info based on active filters
  const {
    title: pageTitle,
    description: pageDescription,
    docsUrl,
  } = detectorFilter
    ? DETECTOR_TYPE_HEADING_MAPPING[detectorFilter]
    : assigneeFilter === 'me'
      ? {
          title: t('My Monitors'),
          description: t(
            'Monitors assigned to you or your team. Monitors are used to customize when to turn errors and performance problems into issues.'
          ),
          docsUrl: 'https://docs.sentry.io/product/monitors/',
        }
      : {
          title: t('Monitors'),
          description: t(
            'Monitors are used to customize when to turn errors and performance problems into issues.'
          ),
          docsUrl: 'https://docs.sentry.io/product/monitors/',
        };

  return (
    <SentryDocumentTitle title={pageTitle}>
      <PageFiltersContainer>
        <ListLayout
          actions={<Actions />}
          title={pageTitle}
          description={pageDescription}
          docsUrl={docsUrl}
        >
          <TableHeader query={query} setQuery={setQuery} />
          <div>
            <VisuallyCompleteWithData
              hasData={(detectors?.length ?? 0) > 0}
              id="MonitorsList-Table"
              isLoading={isLoading}
            >
              {isSuccess && detectors?.length === 0 ? (
                emptyState
              ) : (
                <DetectorListTable
                  detectors={detectors ?? []}
                  isPending={isLoading}
                  isError={isError}
                  isSuccess={isSuccess}
                  queryCount={hitsInt > maxHitsInt ? `${maxHits}+` : hits}
                  allResultsVisible={allResultsVisible()}
                />
              )}
            </VisuallyCompleteWithData>
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
  const {showTimeRangeSelector} = useMonitorViewContext();

  return (
    <Flex gap="xl">
      <PageFilterBar condensed>
        <ProjectPageFilter />
        {showTimeRangeSelector && <DatePageFilter />}
      </PageFilterBar>
      <div style={{flexGrow: 1}}>
        <DetectorSearch initialQuery={query} onSearch={setQuery} />
      </div>
    </Flex>
  );
}

function Actions() {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {detectorFilter} = useMonitorViewContext();

  // Pass the first selected project id that is not the all access project
  const project = selection.projects.find(pid => pid !== ALL_ACCESS_PROJECTS);

  // If detectorFilter is set, pass it as a query param to skip type selection
  const createPath = makeMonitorCreatePathname(organization.slug);

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
