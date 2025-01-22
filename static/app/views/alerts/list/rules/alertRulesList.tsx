import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {
  addErrorMessage,
  addMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {uniq} from 'sentry/utils/array/uniq';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import Projects from 'sentry/utils/projects';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

import {MetricsRemovedAlertsWidgetsAlert} from '../../../metrics/metricsRemovedAlertsWidgetsAlert';
import FilterBar from '../../filterBar';
import type {CombinedAlerts} from '../../types';
import {AlertRuleType, CombinedAlertType} from '../../types';
import {getTeamParams, isIssueAlert} from '../../utils';
import AlertHeader from '../header';

import RuleListRow from './row';

type SortField = 'date_added' | 'name' | ['incident_status', 'date_triggered'];
const defaultSort: SortField = ['incident_status', 'date_triggered'];

function getAlertListQueryKey(orgSlug: string, query: Location['query']): ApiQueryKey {
  const queryParams = {...query};
  queryParams.expand = ['latestIncident', 'lastTriggered'];
  queryParams.team = getTeamParams(queryParams.team!);

  if (!queryParams.sort) {
    queryParams.sort = defaultSort;
  }

  return [`/organizations/${orgSlug}/combined-rules/`, {query: queryParams}];
}

const DataConsentBanner = HookOrDefault({
  hookName: 'component:data-consent-banner',
  defaultComponent: null,
});

function AlertRulesList() {
  const location = useLocation();
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();

  useRouteAnalyticsEventNames('alert_rules.viewed', 'Alert Rules: Viewed');
  useRouteAnalyticsParams({
    sort: Array.isArray(location.query.sort)
      ? location.query.sort.join(',')
      : location.query.sort,
  });

  // Fetch alert rules
  const {
    data: ruleListResponse = [],
    refetch,
    getResponseHeader,
    isPending,
    isError,
  } = useApiQuery<(CombinedAlerts | null)[]>(
    getAlertListQueryKey(organization.slug, location.query),
    {
      staleTime: 0,
    }
  );

  const handleChangeFilter = (activeFilters: string[]) => {
    const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
    router.push({
      pathname: location.pathname,
      query: {
        ...currentQuery,
        team: activeFilters.length > 0 ? activeFilters : '',
      },
    });
  };

  const handleChangeSearch = (name: string) => {
    const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
    router.push({
      pathname: location.pathname,
      query: {
        ...currentQuery,
        name,
      },
    });
  };

  const handleChangeType = (alertType: CombinedAlertType[]) => {
    const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
    router.push({
      pathname: location.pathname,
      query: {
        ...currentQuery,
        alertType,
      },
    });
  };

  const handleOwnerChange = (
    projectId: string,
    rule: CombinedAlerts,
    ownerValue: string
  ) => {
    // TODO(davidenwang): Once we have edit apis for uptime alerts, fill this in
    if (rule.type === CombinedAlertType.UPTIME) {
      return;
    }

    const endpoint =
      rule.type === 'alert_rule'
        ? `/organizations/${organization.slug}/alert-rules/${rule.id}`
        : `/projects/${organization.slug}/${projectId}/rules/${rule.id}/`;
    const updatedRule = {...rule, owner: ownerValue};

    api.request(endpoint, {
      method: 'PUT',
      data: updatedRule,
      success: () => {
        addMessage(t('Updated alert rule'), 'success');
      },
      error: () => {
        addMessage(t('Unable to save change'), 'error');
      },
    });
  };

  const handleDeleteRule = async (projectId: string, rule: CombinedAlerts) => {
    const deleteEndpoints: Record<CombinedAlertType, string> = {
      [CombinedAlertType.ISSUE]: `/projects/${organization.slug}/${projectId}/rules/${rule.id}/`,
      [CombinedAlertType.METRIC]: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      [CombinedAlertType.UPTIME]: `/projects/${organization.slug}/${projectId}/uptime/${rule.id}/`,
      [CombinedAlertType.CRONS]: `/projects/${organization.slug}/${projectId}/monitors/${rule.id}/`,
    };

    try {
      await api.requestPromise(deleteEndpoints[rule.type], {method: 'DELETE'});
      setApiQueryData<(CombinedAlerts | null)[]>(
        queryClient,
        getAlertListQueryKey(organization.slug, location.query),
        data => data?.filter(r => r?.id !== rule.id && r?.type !== rule.type)
      );
      refetch();
      addSuccessMessage(t('Deleted rule'));
    } catch (_err) {
      addErrorMessage(t('Error deleting rule'));
    }
  };

  const hasEditAccess = organization.access.includes('alerts:write');

  const ruleList = ruleListResponse.filter(defined);
  const projectsFromResults = uniq(
    ruleList.flatMap(rule =>
      rule.type === CombinedAlertType.UPTIME
        ? [rule.projectSlug]
        : rule.type === CombinedAlertType.CRONS
          ? [rule.project.slug]
          : rule.projects
    )
  );
  const ruleListPageLinks = getResponseHeader?.('Link');

  const sort: {asc: boolean; field: SortField} = {
    asc: location.query.asc === '1',
    field: (location.query.sort as SortField) || defaultSort,
  };
  const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
  const isAlertRuleSort =
    sort.field.includes('incident_status') || sort.field.includes('date_triggered');
  const sortArrow = (
    <IconArrow color="gray300" size="xs" direction={sort.asc ? 'up' : 'down'} />
  );

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Alerts')} orgSlug={organization.slug} />

      <PageFiltersContainer>
        <AlertHeader activeTab="rules" />
        <Layout.Body>
          <Layout.Main fullWidth>
            <MetricsRemovedAlertsWidgetsAlert organization={organization} />
            <DataConsentBanner source="alerts" />
            <FilterBar
              location={location}
              onChangeFilter={handleChangeFilter}
              onChangeSearch={handleChangeSearch}
              onChangeAlertType={handleChangeType}
              hasTypeFilter
            />
            <StyledPanelTable
              isLoading={isPending}
              isEmpty={ruleList.length === 0 && !isError}
              emptyMessage={t('No alert rules found for the current query.')}
              headers={[
                <StyledSortLink
                  key="name"
                  role="columnheader"
                  aria-sort={
                    sort.field !== 'name' ? 'none' : sort.asc ? 'ascending' : 'descending'
                  }
                  to={{
                    pathname: location.pathname,
                    query: {
                      ...currentQuery,
                      // sort by name should start by ascending on first click
                      asc: sort.field === 'name' && sort.asc ? undefined : '1',
                      sort: 'name',
                    },
                  }}
                >
                  {t('Alert Rule')} {sort.field === 'name' ? sortArrow : null}
                </StyledSortLink>,
                <StyledSortLink
                  key="status"
                  role="columnheader"
                  aria-sort={
                    !isAlertRuleSort ? 'none' : sort.asc ? 'ascending' : 'descending'
                  }
                  to={{
                    pathname: location.pathname,
                    query: {
                      ...currentQuery,
                      asc: isAlertRuleSort && !sort.asc ? '1' : undefined,
                      sort: ['incident_status', 'date_triggered'],
                    },
                  }}
                >
                  {t('Status')} {isAlertRuleSort ? sortArrow : null}
                </StyledSortLink>,
                t('Project'),
                t('Team'),
                t('Actions'),
              ]}
            >
              {isError ? (
                <StyledLoadingError
                  message={t('There was an error loading alerts.')}
                  onRetry={refetch}
                />
              ) : null}
              <VisuallyCompleteWithData
                id="AlertRules-Body"
                hasData={ruleList.length > 0}
              >
                <Projects orgId={organization.slug} slugs={projectsFromResults}>
                  {({initiallyLoaded, projects}) =>
                    ruleList.map(rule => {
                      const isIssueAlertInstance = isIssueAlert(rule);
                      const keyPrefix = isIssueAlertInstance
                        ? AlertRuleType.ISSUE
                        : rule.type === CombinedAlertType.UPTIME
                          ? AlertRuleType.UPTIME
                          : AlertRuleType.METRIC;

                      return (
                        <RuleListRow
                          // Metric and issue alerts can have the same id
                          key={`${keyPrefix}-${rule.id}`}
                          projectsLoaded={initiallyLoaded}
                          projects={projects as Project[]}
                          rule={rule}
                          orgId={organization.slug}
                          onOwnerChange={handleOwnerChange}
                          onDelete={handleDeleteRule}
                          hasEditAccess={hasEditAccess}
                        />
                      );
                    })
                  }
                </Projects>
              </VisuallyCompleteWithData>
            </StyledPanelTable>
            <Pagination
              pageLinks={ruleListPageLinks}
              onCursor={(cursor, path, _direction) => {
                let team = currentQuery.team;
                // Keep team parameter, but empty to remove parameters
                if (!team || team.length === 0) {
                  team = '';
                }

                router.push({
                  pathname: path,
                  query: {...currentQuery, team, cursor},
                });
              }}
            />
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </Fragment>
  );
}

export default AlertRulesList;

const StyledLoadingError = styled(LoadingError)`
  grid-column: 1 / -1;
  margin-bottom: ${space(4)};
  border-radius: 0;
  border-width: 1px 0;
`;

const StyledSortLink = styled(Link)`
  color: inherit;
  display: flex;
  align-items: center;
  gap: ${space(0.5)};

  :hover {
    color: inherit;
  }
`;

const StyledPanelTable = styled(PanelTable)`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    overflow: initial;
  }

  grid-template-columns: minmax(250px, 4fr) auto auto 60px auto;
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};
`;
