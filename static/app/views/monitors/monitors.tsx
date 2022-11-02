import {Fragment} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import Access from 'sentry/components/acl/access';
import Button from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import Link from 'sentry/components/links/link';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelItem} from 'sentry/components/panels';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {PageHeader} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {decodeScalar} from 'sentry/utils/queryString';
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
        <PageHeader>
          <HeaderTitle>
            <div>
              {t('Monitors')} <FeatureBadge type="beta" />
            </div>
            <Access organization={organization} access={['project:write']}>
              {({hasAccess}) => (
                <Button
                  to={`/organizations/${organization.slug}/monitors/create/`}
                  priority="primary"
                  size="sm"
                  disabled={!hasAccess}
                  tooltipProps={{
                    disabled: hasAccess,
                  }}
                  title={t('You must be an organization admin to create a new monitor')}
                >
                  {t('New Monitor')}
                </Button>
              )}
            </Access>
          </HeaderTitle>
        </PageHeader>
        <Filters>
          <ProjectPageFilter resetParamsOnChange={['cursor']} />
          <SearchBar
            query={decodeScalar(qs.parse(location.search)?.query, '')}
            placeholder={t('Search for monitors.')}
            onSearch={this.handleSearch}
          />
        </Filters>
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
    );
  }
}

const HeaderTitle = styled(PageHeading)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
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
