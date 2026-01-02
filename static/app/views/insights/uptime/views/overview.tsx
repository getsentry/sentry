import {Fragment} from 'react';
import styled from '@emotion/styled';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import EmptyMessage from 'sentry/components/emptyMessage';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {type UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';
import {OverviewTimeline} from 'sentry/views/insights/uptime/components/overviewTimeline';
import {MODULE_DESCRIPTION, MODULE_DOC_LINK} from 'sentry/views/insights/uptime/settings';

export default function UptimeOverview() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const project = decodeList(location.query?.project);
  const {projects} = useProjects();

  const {
    data: detectors,
    getResponseHeader: uptimeListHeaders,
    isPending,
  } = useDetectorsQuery<UptimeDetector>({
    query: `type:uptime ${location.query.query ?? ''}`,
    cursor: decodeScalar(location.query.cursor),
    projects: project.map(Number),
  });

  useRouteAnalyticsEventNames('uptime.page_viewed', 'Uptime: Page Viewed');
  useRouteAnalyticsParams({empty_state: !detectors || detectors.length === 0});

  const uptimeListPageLinks = uptimeListHeaders?.('Link');

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
          <ButtonBar>
            <FeedbackButton />
            <LinkButton
              size="sm"
              priority="primary"
              to={makeAlertsPathname({path: `/new/uptime/`, organization})}
              icon={<IconAdd />}
              disabled={!canCreateAlert}
              title={canCreateAlert ? undefined : permissionTooltipText}
            >
              {t('Add Uptime Monitor')}
            </LinkButton>
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main width="full">
          <Filters>
            <PageFilterBar>
              <ProjectPageFilter resetParamsOnChange={['cursor']} />
              <DatePageFilter />
            </PageFilterBar>
            <DetectorSearch
              initialQuery=""
              placeholder={t('Filter uptime monitors')}
              excludeKeys={['type']}
              onSearch={query => {
                navigate(
                  {
                    ...location,
                    query: {...location.query, query, cursor: undefined},
                  },
                  {replace: true}
                );
              }}
            />
          </Filters>
          {isPending ? (
            <LoadingIndicator />
          ) : detectors?.length ? (
            <Fragment>
              <OverviewTimeline uptimeDetectors={detectors} />
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
                    to={makeAlertsPathname({path: `/new/uptime/`, organization})}
                    icon={<IconAdd />}
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
