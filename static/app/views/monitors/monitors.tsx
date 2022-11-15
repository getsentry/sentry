import {Fragment} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import Access from 'sentry/components/acl/access';
import Button, {ButtonProps} from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelItem} from 'sentry/components/panels';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import TimeSince from 'sentry/components/timeSince';
import useLazyLoad from 'sentry/components/useLazyLoad';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import MonitorIcon from './monitorIcon';
import {Monitor} from './types';

type Props = AsyncView['props'] &
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
    trackAdvancedAnalyticsEvent('monitors.page_viewed', {
      organization: this.props.organization.id,
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
                <Panel>
                  <PanelBody>
                    {monitorList?.map(monitor => (
                      <PanelItemCentered key={monitor.id}>
                        <MonitorIcon status={monitor.status} size={16} />
                        <StyledLink
                          to={`/organizations/${organization.slug}/monitors/${monitor.id}/`}
                        >
                          {monitor.name}
                        </StyledLink>
                        {monitor.nextCheckIn ? (
                          <StyledTimeSince date={monitor.lastCheckIn} />
                        ) : (
                          t('n/a')
                        )}
                      </PanelItemCentered>
                    ))}
                  </PanelBody>
                </Panel>
                {monitorListPageLinks && (
                  <Pagination pageLinks={monitorListPageLinks} {...this.props} />
                )}
              </Fragment>
            ) : (
              <MonitorsOnboardingPanel />
            )}
          </Layout.Main>
        </Layout.Body>
      </Fragment>
    );
  }
}

function MonitorsOnboardingPanel() {
  const src = useLazyLoad({
    loader: async () =>
      (await import('sentry-images/spot/onboarding-preview.svg')).default,
  });

  return (
    <OnboardingPanel image={<img src={src} />}>
      <h3>{t('Monitor your recurring jobs')}</h3>
      <p>
        {t(
          'Stop worrying about the status of your cron jobs. Let us notify you when your jobs take too long or do not execute on schedule.'
        )}
      </p>
      <NewMonitorButton>{t('Create a Monitor')}</NewMonitorButton>
    </OnboardingPanel>
  );
}

const HeaderTitle = styled(Layout.Title)`
  margin-top: 0;
`;

const PanelItemCentered = styled(PanelItem)`
  align-items: center;
  padding: 0;
  padding-left: ${space(2)};
  padding-right: ${space(2)};
`;

const StyledLink = styled(Link)`
  flex: 1;
  padding: ${space(2)};
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

export default withRouter(withOrganization(Monitors));
