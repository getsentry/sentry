import {Fragment} from 'react';
import {WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import onboardingImg from 'sentry-images/spot/onboarding-preview.svg';

import Button, {ButtonProps} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
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
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';
import AsyncView from 'sentry/views/asyncView';

import CronsFeedbackButton from './cronsFeedbackButton';
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
    <Button
      to={`/organizations/${organization.slug}/crons/create/`}
      priority="primary"
      {...props}
    >
      {props.children}
    </Button>
  );
}

class Monitors extends AsyncView<Props, State> {
  get orgSlug() {
    return this.props.organization.slug;
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {location} = this.props;
    return [
      [
        'monitorList',
        `/organizations/${this.orgSlug}/monitors/`,
        {
          query: location.query,
        },
      ],
    ];
  }

  getTitle() {
    return `Monitors - ${this.orgSlug}`;
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
              {t('Cron Monitors')} <FeatureBadge type="beta" />
            </HeaderTitle>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <NewMonitorButton size="sm">{t('Set Up Cron Monitor')}</NewMonitorButton>
              <CronsFeedbackButton />
            </ButtonBar>
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
                          to={`/organizations/${organization.slug}/crons/${monitor.id}/`}
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
                <h3>{t('Let Sentry Monitor Your Recurring Jobs')}</h3>
                <p>
                  {t(
                    "We'll tell you if your recurring jobs are running on schedule, failing, or succeeding."
                  )}
                </p>
                <ButtonList gap={1}>
                  <Button href="https://docs.sentry.io/product/crons" external>
                    {t('View the Docs')}
                  </Button>
                  <NewMonitorButton>{t('Set Up First Cron Monitor')}</NewMonitorButton>
                </ButtonList>
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

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

export default withRouteAnalytics(withSentryRouter(withOrganization(Monitors)));
