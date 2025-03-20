import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {LinkButton} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import EmptyMessage from 'sentry/components/emptyMessage';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import SearchBar from 'sentry/components/searchBar';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {ModuleName} from 'sentry/views/insights/types';
import {OwnerFilter} from 'sentry/views/monitors/components/ownerFilter';

import {MODULE_DESCRIPTION, MODULE_DOC_LINK, MODULE_TITLE} from '../../uptime/settings';
import {OverviewTimeline} from '../components/overviewTimeline';

export default function UptimeOverview() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const project = decodeList(location.query?.project);
  const {projects} = useProjects();
  const {view = ''} = useDomainViewFilters();

  function makeQueryKey() {
    const {query, environment, owner, cursor, sort, asc} = location.query;
    return [
      `/organizations/${organization.slug}/uptime/`,
      {
        query: {
          cursor,
          query,
          project,
          environment,
          owner,
          includeNew: true,
          per_page: 20,
          sort,
          asc,
        },
      },
    ] as const;
  }

  const {
    data: uptimeRules,
    getResponseHeader: uptimeListHeaders,
    isPending,
  } = useApiQuery<UptimeRule[]>(makeQueryKey(), {staleTime: 0});

  useRouteAnalyticsEventNames('uptime.page_viewed', 'Uptime: Page Viewed');
  useRouteAnalyticsParams({empty_state: !uptimeRules || uptimeRules.length === 0});

  const uptimeListPageLinks = uptimeListHeaders?.('Link');

  const handleSearch = (query: string) => {
    const currentQuery = {...location.query, cursor: undefined};
    navigate({
      pathname: location.pathname,
      query: normalizeDateTimeParams({...currentQuery, query}),
    });
  };

  const canCreateAlert =
    hasEveryAccess(['alerts:write'], {organization}) ||
    projects.some(p => hasEveryAccess(['alerts:write'], {project: p}));
  const permissionTooltipText = tct(
    'Ask your organization owner or manager to [settingsLink:enable alerts access] for you.',
    {settingsLink: <Link to={`/settings/${organization.slug}`} />}
  );

  const headerProps = {
    module: ModuleName.UPTIME,
    headerTitle: (
      <Fragment>
        {MODULE_TITLE}
        <PageHeadingQuestionTooltip
          docsUrl={MODULE_DOC_LINK}
          title={MODULE_DESCRIPTION}
        />
      </Fragment>
    ),
    headerActions: (
      <ButtonBar gap={1}>
        <LinkButton
          size="sm"
          priority="primary"
          to={makeAlertsPathname({
            path: `/new/uptime/`,
            organization,
          })}
          icon={<IconAdd isCircled />}
          disabled={!canCreateAlert}
          title={canCreateAlert ? undefined : permissionTooltipText}
        >
          {t('Add Uptime Monitor')}
        </LinkButton>
      </ButtonBar>
    ),
  };

  return (
    <ModulePageProviders moduleName="uptime" pageTitle={t('Overview')}>
      {view === FRONTEND_LANDING_SUB_PATH && <FrontendHeader {...headerProps} />}
      {view === BACKEND_LANDING_SUB_PATH && <BackendHeader {...headerProps} />}
      <Layout.Body>
        <Layout.Main fullWidth>
          <Filters>
            <OwnerFilter
              selectedOwners={decodeList(location.query.owner)}
              onChangeFilter={owner => {
                navigate(
                  {
                    ...location,
                    query: {...location.query, owner, cursor: undefined},
                  },
                  {replace: true}
                );
              }}
            />
            <PageFilterBar>
              <ProjectPageFilter resetParamsOnChange={['cursor']} />
              <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
              <DatePageFilter />
            </PageFilterBar>
            <SearchBar
              query={decodeScalar(qs.parse(location.search)?.query, '')}
              placeholder={t('Search by name or slug')}
              onSearch={handleSearch}
            />
          </Filters>
          {isPending ? (
            <LoadingIndicator />
          ) : uptimeRules?.length ? (
            <Fragment>
              <OverviewTimeline uptimeRules={uptimeRules} />
              {uptimeListPageLinks && <Pagination pageLinks={uptimeListPageLinks} />}
            </Fragment>
          ) : (
            <Panel>
              <EmptyMessage
                title={t('The selected projects have no uptime monitors')}
                action={
                  <LinkButton
                    size="sm"
                    priority="primary"
                    to={makeAlertsPathname({
                      path: `/new/uptime/`,
                      organization,
                    })}
                    icon={<IconAdd isCircled />}
                  >
                    {t('Add Uptime Monitor')}
                  </LinkButton>
                }
              />
            </Panel>
          )}
        </Layout.Main>
      </Layout.Body>
    </ModulePageProviders>
  );
}

const Filters = styled('div')`
  display: flex;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};

  > :last-child {
    flex-grow: 1;
  }
`;
