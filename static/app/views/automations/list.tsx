import {Fragment, useCallback} from 'react';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import ListLayout from 'sentry/components/workflowEngine/layout/list';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import AutomationListTable from 'sentry/views/automations/components/automationListTable';
import {AutomationSearch} from 'sentry/views/automations/components/automationListTable/search';
import {AUTOMATION_LIST_PAGE_LIMIT} from 'sentry/views/automations/constants';
import {useAutomationsQuery} from 'sentry/views/automations/hooks';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';

export default function AutomationsList() {
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
  const sort = sorts[0] ?? {kind: 'desc', field: 'lastTriggered'};

  const {
    data: automations,
    isLoading,
    isError,
    isSuccess,
    getResponseHeader,
  } = useAutomationsQuery(
    {
      cursor,
      query,
      sortBy: sort ? `${sort?.kind === 'asc' ? '' : '-'}${sort?.field}` : undefined,
      projects: selection.projects,
      limit: AUTOMATION_LIST_PAGE_LIMIT,
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
    <SentryDocumentTitle title={t('Automations')} noSuffix>
      <PageFiltersContainer>
        <ListLayout actions={<Actions />}>
          <TableHeader />
          <div>
            <AutomationListTable
              automations={automations ?? []}
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
  const initialQuery =
    typeof location.query.query === 'string' ? location.query.query : '';

  const onSearch = useCallback(
    (query: string) => {
      navigate({
        pathname: location.pathname,
        query: {...location.query, query, cursor: undefined},
      });
    },
    [location.pathname, location.query, navigate]
  );

  return (
    <Flex gap="xl">
      <ProjectPageFilter size="md" />
      <div style={{flexGrow: 1}}>
        <AutomationSearch initialQuery={initialQuery} onSearch={onSearch} />
      </div>
    </Flex>
  );
}

function Actions() {
  const organization = useOrganization();
  return (
    <Fragment>
      <LinkButton
        to={`${makeAutomationBasePathname(organization.slug)}new/`}
        priority="primary"
        icon={<IconAdd />}
        size="sm"
      >
        {t('Create Automation')}
      </LinkButton>
    </Fragment>
  );
}
