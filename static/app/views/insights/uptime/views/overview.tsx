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
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
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
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {ModuleName} from 'sentry/views/insights/types';
import {OwnerFilter} from 'sentry/views/monitors/components/ownerFilter';

import {MODULE_DESCRIPTION, MODULE_DOC_LINK, MODULE_TITLE} from '../../uptime/settings';
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
    data: uptimeRules,
    getResponseHeader: uptimeListHeaders,
    isPending,
  } = useApiQuery<UptimeRule[]>(makeQueryKey(), {staleTime: 0});

  useRouteAnalyticsEventNames('uptime.page_viewed', 'Uptime: Page Viewed');
  useRouteAnalyticsParams({empty_state: !uptimeRules || uptimeRules.length === 0});

  const uptimeListPageLinks = uptimeListHeaders?.('Link');

  const handleSearch = (query: string) => {
    const currentQuery = {...(location.query ?? {}), cursor: undefined};
    navigate({
      pathname: location.pathname,
      query: normalizeDateTimeParams({...currentQuery, query}),
    });
  };

  const creationDisabled = organization.features.includes('uptime-create-disabled');

  return (
    <ModulePageProviders moduleName="uptime" pageTitle={t('Overview')}>
      <BackendHeader
        module={ModuleName.UPTIME}
        headerTitle={
          <Fragment>
            {MODULE_TITLE}
            <PageHeadingQuestionTooltip
              docsUrl={MODULE_DOC_LINK}
              title={MODULE_DESCRIPTION}
            />
          </Fragment>
        }
        headerActions={
          <ButtonBar gap={1}>
            <LinkButton
              disabled={creationDisabled}
              title={
                creationDisabled
                  ? t(
                      'Creation of new uptime alerts is temporarily disabled as the beta has ended. Alert creation will be available again in a few days.'
                    )
                  : undefined
              }
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
