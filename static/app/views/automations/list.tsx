import {useCallback} from 'react';
import {useQuery} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Pagination} from 'sentry/components/pagination';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {AlertsMonitorsShowcaseButton} from 'sentry/components/workflowEngine/alertsMonitorsShowcaseButton';
import {WorkflowEngineListLayout as ListLayout} from 'sentry/components/workflowEngine/layout/list';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {useLocationQuery} from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AutomationFeedbackButton} from 'sentry/views/automations/components/automationFeedbackButton';
import {AutomationListTable} from 'sentry/views/automations/components/automationListTable';
import {AutomationSearch} from 'sentry/views/automations/components/automationListTable/search';
import {AUTOMATION_LIST_PAGE_LIMIT} from 'sentry/views/automations/constants';
import {automationsApiOptions} from 'sentry/views/automations/hooks';
import {makeAutomationCreatePathname} from 'sentry/views/automations/pathnames';

export default function AutomationsList() {
  const organization = useOrganization();
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

  const {data, isLoading, isError, isSuccess} = useQuery({
    ...automationsApiOptions(organization, {
      query,
      sortBy: sort ? `${sort?.kind === 'asc' ? '' : '-'}${sort?.field}` : undefined,
      projects: selection.projects,
      limit: AUTOMATION_LIST_PAGE_LIMIT,
      cursor,
    }),
    select: selectJsonWithHeaders,
    enabled: isReady,
  });

  const automations = data?.json;
  const hits = data?.headers['X-Hits'] ?? 0;
  // If maxHits is not set, we assume there is no max
  const maxHits = data?.headers['X-Max-Hits'] ?? Infinity;
  const pageLinks = data?.headers.Link;

  const allResultsVisible = useCallback(() => {
    if (!pageLinks) {
      return false;
    }
    const links = parseLinkHeader(pageLinks);
    return links && !links.previous!.results && !links.next!.results;
  }, [pageLinks]);

  return (
    <SentryDocumentTitle title={t('Alerts')}>
      <ListLayout
        actions={<Actions />}
        title={t('Alerts')}
        description={t(
          'Alerts are triggered when issue changes state, is created, or passes a threshold. They perform external actions like sending notifications, creating tickets, or calling webhooks and integrations.'
        )}
        docsUrl="https://docs.sentry.io/product/new-monitors-and-alerts/alerts/"
      >
        <TableHeader />
        <div>
          <VisuallyCompleteWithData
            hasData={(automations?.length ?? 0) > 0}
            id="AutomationsList-Table"
            isLoading={isLoading}
          >
            <AutomationListTable
              automations={automations ?? []}
              isPending={isLoading}
              isError={isError}
              isSuccess={isSuccess}
              sort={sort}
              queryCount={hits > maxHits ? `${maxHits}+` : `${hits}`}
              allResultsVisible={allResultsVisible()}
            />
          </VisuallyCompleteWithData>
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
    <Flex gap="sm">
      <AlertsMonitorsShowcaseButton />
      <AutomationFeedbackButton />
      <LinkButton
        to={makeAutomationCreatePathname(organization.slug)}
        priority="primary"
        icon={<IconAdd />}
        size="sm"
      >
        {t('Create Alert')}
      </LinkButton>
    </Flex>
  );
}
