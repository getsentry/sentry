import {Fragment} from 'react';
import {WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import onboardingImg from 'sentry-images/spot/onboarding-preview.svg';

import {Button, ButtonProps} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

import CronsFeedbackButton from './components/cronsFeedbackButton';
import {MonitorRow} from './components/row';
import {Monitor, MonitorEnvironment} from './types';

type Props = AsyncView['props'] &
  WithRouteAnalyticsProps &
  WithRouterProps<{}> & {
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
        `/organizations/${this.orgSlug}/monitors/?includeNew`,
        {
          query: location.query,
        },
      ],
    ];
  }

  getTitle() {
    return `Crons - ${this.orgSlug}`;
  }

  onRequestSuccess(response): void {
    this.props.setEventNames('monitors.page_viewed', 'Monitors: Page Viewed');
    this.props.setRouteAnalyticsParams({
      empty_state: response.data.length === 0,
    });
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

    const renderMonitorRow = (monitor: Monitor, monitorEnv?: MonitorEnvironment) => (
      <MonitorRow
        key={monitor.slug}
        monitor={monitor}
        monitorEnv={monitorEnv}
        onDelete={() => {
          if (monitorList) {
            this.setState({
              monitorList: monitorList.filter(m => m.slug !== monitor.slug),
            });
          }
        }}
        organization={organization}
      />
    );

    return (
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>
              {t('Cron Monitors')}
              <PageHeadingQuestionTooltip
                title={t(
                  'Scheduled monitors that check in on recurring jobs and tell you if they’re running on schedule, failing, or succeeding.'
                )}
                docsUrl="https://docs.sentry.io/product/crons/"
              />
              <FeatureBadge type="beta" />
            </Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <CronsFeedbackButton />
              <NewMonitorButton size="sm" icon={<IconAdd isCircled size="xs" />}>
                {t('Add Monitor')}
              </NewMonitorButton>
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <Filters>
              <PageFilterBar>
                <ProjectPageFilter resetParamsOnChange={['cursor']} />
                <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
              </PageFilterBar>
              <SearchBar
                query={decodeScalar(qs.parse(location.search)?.query, '')}
                placeholder={t('Search by name')}
                onSearch={this.handleSearch}
              />
            </Filters>
            {monitorList?.length ? (
              <Fragment>
                <StyledPanelTable
                  headers={[
                    t('Monitor Name'),
                    t('Status'),
                    t('Schedule'),
                    t('Next Checkin'),
                    t('Project'),
                    t('Environment'),
                    t('Actions'),
                  ]}
                >
                  {monitorList
                    ?.map(monitor =>
                      monitor.environments.length > 0
                        ? monitor.environments.map(monitorEnv =>
                            renderMonitorRow(monitor, monitorEnv)
                          )
                        : renderMonitorRow(monitor)
                    )
                    .flat()}
                </StyledPanelTable>
                {monitorListPageLinks && (
                  <Pagination pageLinks={monitorListPageLinks} {...this.props} />
                )}
              </Fragment>
            ) : (
              <OnboardingPanel image={<img src={onboardingImg} />}>
                <h3>{t('Let Sentry monitor your recurring jobs')}</h3>
                <p>
                  {t(
                    "We'll tell you if your recurring jobs are running on schedule, failing, or succeeding."
                  )}
                </p>
                <ButtonList gap={1}>
                  <NewMonitorButton>{t('Set up first cron monitor')}</NewMonitorButton>
                  <Button href="https://docs.sentry.io/product/crons" external>
                    {t('Read docs')}
                  </Button>
                </ButtonList>
              </OnboardingPanel>
            )}
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }
}

const Filters = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr max-content 1fr max-content max-content max-content max-content;
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

export default withRouteAnalytics(withSentryRouter(withOrganization(Monitors)));
