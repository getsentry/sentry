import {useCallback} from 'react';
import {useQuery} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';

import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {QueryCount} from 'sentry/components/queryCount';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {AlertsMonitorsShowcaseButton} from 'sentry/components/workflowEngine/alertsMonitorsShowcaseButton';
import {WorkflowEngineListLayout as ListLayout} from 'sentry/components/workflowEngine/layout/list';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseCursor} from 'sentry/utils/cursor';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AutomationFeedbackButton} from 'sentry/views/automations/components/automationFeedbackButton';
import {AutomationListTable} from 'sentry/views/automations/components/automationListTable';
import {AutomationSearch} from 'sentry/views/automations/components/automationListTable/search';
import {AUTOMATION_LIST_PAGE_LIMIT} from 'sentry/views/automations/constants';
import {useAutomationListQueryOptions} from 'sentry/views/automations/hooks/useAutomationListDetectors';
import {
  getNoAlertWritePermissionTooltip,
  useCanEditAutomation,
} from 'sentry/views/automations/hooks/useCanEditAutomation';
import {makeAutomationCreatePathname} from 'sentry/views/automations/pathnames';

export default function AutomationsList() {
  const location = useLocation();
  const navigate = useNavigate();

  const {queryOptions, enabled, cursor, sort} = useAutomationListQueryOptions();
  const {data, isLoading, isError, isSuccess} = useQuery({
    ...queryOptions,
    select: selectJsonWithHeaders,
    enabled,
  });

  const automations = data?.json;
  const hits = data?.headers['X-Hits'] ?? 0;
  // OffsetPaginator currently omits X-Max-Hits. Fall back to the server's default
  // hit ceiling so early pages can still render lower-bound totals like "1000+".
  const maxHits = data?.headers['X-Max-Hits'] ?? 1000;
  const pageLinks = data?.headers.Link;

  const allResultsVisible = useCallback(() => {
    if (!pageLinks) {
      return false;
    }
    const links = parseLinkHeader(pageLinks);
    return links && !links.previous!.results && !links.next!.results;
  }, [pageLinks]);

  const offset = parseCursor(cursor)?.offset ?? 0;
  const pageStart = offset * AUTOMATION_LIST_PAGE_LIMIT + 1;
  // Also treat deep pages past the reported hit count as capped, in case the
  // response omits both a useful max and a stable ceiling.
  const isCappedTotal = hits >= maxHits || pageStart > hits;
  const cappedTotal = isCappedTotal ? maxHits : undefined;
  const queryCount = isCappedTotal ? `${cappedTotal}+` : `${hits}`;

  let paginationCaption: React.ReactNode;
  if (!isLoading && automations && automations.length > 0) {
    const end = pageStart + automations.length - 1;

    paginationCaption = tct('[start]-[end] of [total]', {
      start: pageStart.toLocaleString(),
      end: end.toLocaleString(),
      total: <QueryCount count={hits} max={cappedTotal} hideIfEmpty={false} hideParens />,
    });
  }

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
              queryCount={queryCount}
              allResultsVisible={allResultsVisible()}
            />
          </VisuallyCompleteWithData>
          <Pagination
            pageLinks={pageLinks}
            caption={paginationCaption}
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
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const canCreateAlert = useCanEditAutomation();
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
      <Flex
        flexGrow={1}
        gap="md"
        align={{'screen:xs': 'stretch', 'screen:md': 'center'}}
        direction={{'screen:xs': 'column', 'screen:md': 'row'}}
      >
        <div style={{flexGrow: 1}}>
          <AutomationSearch initialQuery={initialQuery} onSearch={onSearch} />
        </div>
        <LinkButton
          to={makeAutomationCreatePathname(organization.slug)}
          disabled={!canCreateAlert}
          tooltipProps={{
            title: canCreateAlert ? undefined : getNoAlertWritePermissionTooltip(),
            isHoverable: true,
          }}
          variant="primary"
          icon={<IconAdd />}
          size="sm"
        >
          {t('Create Alert')}
        </LinkButton>
      </Flex>
    </Flex>
  );
}

function Actions() {
  return (
    <Flex gap="sm">
      <AlertsMonitorsShowcaseButton />
      <AutomationFeedbackButton />
    </Flex>
  );
}
