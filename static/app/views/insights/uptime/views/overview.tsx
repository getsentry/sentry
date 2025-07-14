import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import EmptyMessage from 'sentry/components/emptyMessage';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
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
import {OwnerFilter} from 'sentry/views/insights/crons/components/ownerFilter';
import {OverviewTimeline} from 'sentry/views/insights/uptime/components/overviewTimeline';
import {MODULE_DESCRIPTION, MODULE_DOC_LINK} from 'sentry/views/insights/uptime/settings';

export default function UptimeOverview() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const project = decodeList(location.query?.project);
  const {projects} = useProjects();

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

  const page = (
    <Fragment>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Uptime Monitors')}
            <PageHeadingQuestionTooltip
              docsUrl={MODULE_DOC_LINK}
              title={MODULE_DESCRIPTION}
            />
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap="md">
            <FeedbackWidgetButton />
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
        </Layout.HeaderActions>
      </Layout.Header>
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
    </Fragment>
  );

  return (
    <NoProjectMessage organization={organization}>
      <SentryDocumentTitle title={t('Uptime Monitors')} orgSlug={organization.slug}>
        <PageFiltersContainer>{page}</PageFiltersContainer>
      </SentryDocumentTitle>
    </NoProjectMessage>
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
