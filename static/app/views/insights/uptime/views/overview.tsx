import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EmptyMessage from 'sentry/components/emptyMessage';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import SearchBar from 'sentry/components/searchBar';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import type {UptimeAlert} from 'sentry/views/alerts/types';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {ModuleName} from 'sentry/views/insights/types';
import {OwnerFilter} from 'sentry/views/monitors/components/ownerFilter';

import {OverviewTimeline} from '../components/overviewTimeline';

export default function UptimeOverview() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const project = decodeList(location.query?.project);

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
    data: uptimeList,
    getResponseHeader: uptimeListHeaders,
    isPending,
  } = useApiQuery<UptimeAlert[]>(makeQueryKey(), {staleTime: 0});

  useRouteAnalyticsEventNames('uptime.page_viewed', 'Uptime: Page Viewed');
  useRouteAnalyticsParams({empty_state: !uptimeList || uptimeList.length === 0});

  const uptimeListPageLinks = uptimeListHeaders?.('Link');

  const handleSearch = (query: string) => {
    const currentQuery = {...(location.query ?? {}), cursor: undefined};
    navigate({
      pathname: location.pathname,
      query: normalizeDateTimeParams({...currentQuery, query}),
    });
  };

  return (
    <ModulePageProviders moduleName="uptime" pageTitle={t('Overview')}>
      <BackendHeader
        module={ModuleName.UPTIME}
        headerActions={
          <ButtonBar gap={1}>
            <LinkButton
              size="sm"
              priority="primary"
              to={`/organizations/${organization.slug}/alerts/new/uptime/`}
              icon={<IconAdd isCircled />}
            >
              {t('Add Uptime Monitor')}
            </LinkButton>
          </ButtonBar>
        }
      />
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
          ) : uptimeList?.length ? (
            <Fragment>
              <OverviewTimeline uptimeAlerts={uptimeList} />
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
                    to={`/organizations/${organization.slug}/alerts/new/uptime/`}
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
