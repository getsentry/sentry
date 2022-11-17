import {Fragment} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import onboardingImg from 'sentry-images/spot/onboarding-preview.svg';

import Access from 'sentry/components/acl/access';
import Button, {ButtonProps} from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {decodeScalar} from 'sentry/utils/queryString';
import withRouteAnalytics, {
  WithRouteAnalyticsProps,
} from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import useOrganization from 'sentry/utils/useOrganization';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import MonitorIcon from './monitorIcon';
import {Monitor} from './types';

type Props = AsyncView['props'] &
  WithRouteAnalyticsProps &
  WithRouterProps<{orgId: string}> & {
    organization: Organization;
  };

type State = AsyncView['state'] & {
  monitorList: Monitor[] | null;
};

function NewMonitorButton(props: ButtonProps) {
  const organization = useOrganization();
  return (
    <Access organization={organization} access={['project:write']}>
      {({hasAccess}) => (
        <Button
          to={`/organizations/${organization.slug}/monitors/create/`}
          priority="primary"
          disabled={!hasAccess}
          tooltipProps={{
            disabled: hasAccess,
          }}
          title={t(
            'You must be an organization owner, manager, or admin to create a new monitor'
          )}
          {...props}
        >
          {props.children}
        </Button>
      )}
    </Access>
  );
}

class Monitors extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params, location} = this.props;
    return [
      [
        'monitorList',
        `/organizations/${params.orgId}/monitors/`,
        {
          query: location.query,
        },
      ],
    ];
  }

  getTitle() {
    return `Monitors - ${this.props.params.orgId}`;
  }

  componentDidMount() {
    this.props.setEventNames('monitors.page_viewed', 'Monitors: Page Viewed');
  }
  handleSearch = (query: string) => {
    const {location, router} = this.props;
    router.push({
      pathname: location.pathname,
      query: normalizeDateTimeParams({
        ...(location.query || {}),
        query,
      }),
    });
  };

  renderBody() {
    const {monitorList, monitorListPageLinks} = this.state;
    const {organization} = this.props;

    return (
      <Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <HeaderTitle>
              {t('Monitors')} <FeatureBadge type="beta" />
            </HeaderTitle>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <NewMonitorButton size="sm">{t('New Monitor')}</NewMonitorButton>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <Filters>
              <ProjectPageFilter resetParamsOnChange={['cursor']} />
              <SearchBar
                query={decodeScalar(qs.parse(location.search)?.query, '')}
                placeholder={t('Search for monitors.')}
                onSearch={this.handleSearch}
              />
            </Filters>
            {monitorList?.length ? (
              <Fragment>
                <StyledPanelTable
                  headers={[t('Monitor Name'), t('Last Check-In'), t('Project')]}
                >
                  {monitorList?.map(monitor => (
                    <Fragment key={monitor.id}>
                      <MonitorName>
                        <MonitorIcon status={monitor.status} size={16} />
                        <StyledLink
                          to={`/organizations/${organization.slug}/monitors/${monitor.id}/`}
                        >
                          {monitor.name}
                        </StyledLink>
                      </MonitorName>
                      {monitor.nextCheckIn ? (
                        <StyledTimeSince date={monitor.lastCheckIn} />
                      ) : (
                        <div>{t('n/a')}</div>
                      )}
                      <IdBadge
                        project={monitor.project}
                        avatarSize={18}
                        avatarProps={{hasTooltip: true, tooltip: monitor.project.slug}}
                      />
                    </Fragment>
                  ))}
                </StyledPanelTable>
                {monitorListPageLinks && (
                  <Pagination pageLinks={monitorListPageLinks} {...this.props} />
                )}
              </Fragment>
            ) : (
              <OnboardingPanel image={<img src={onboardingImg} />}>
                <h3>{t('Monitor your recurring jobs')}</h3>
                <p>
                  {t(
                    'Stop worrying about the status of your cron jobs. Let us notify you when your jobs take too long or do not execute on schedule.'
                  )}
                </p>
                <NewMonitorButton>{t('Create a Monitor')}</NewMonitorButton>
              </OnboardingPanel>
            )}
          </Layout.Main>
        </Layout.Body>
      </Fragment>
    );
  }
}

const HeaderTitle = styled(Layout.Title)`
  margin-top: 0;
`;

const StyledLink = styled(Link)`
  flex: 1;
  margin-left: ${space(2)};
`;

const StyledTimeSince = styled(TimeSince)`
  font-variant-numeric: tabular-nums;
`;

const Filters = styled('div')`
  display: grid;
  grid-template-columns: minmax(auto, 300px) 1fr;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};
`;

const MonitorName = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr max-content max-content;
`;

export default withRouteAnalytics(withRouter(withOrganization(Monitors)));
