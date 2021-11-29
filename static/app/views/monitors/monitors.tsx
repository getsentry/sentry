import {Fragment} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import Button from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import Link from 'sentry/components/links/link';
import {getParams} from 'sentry/components/organizations/globalSelectionHeader/getParams';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelItem} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {PageHeader} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
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

  handleSearch = (query: string) => {
    const {location, router} = this.props;
    router.push({
      pathname: location.pathname,
      query: getParams({
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
            <NewMonitorButton
              to={`/organizations/${organization.slug}/monitors/create/`}
              priority="primary"
              size="xsmall"
            >
              {t('New Monitor')}
            </NewMonitorButton>
          </HeaderTitle>
          <StyledSearchBar
            query={decodeScalar(qs.parse(location.search)?.query, '')}
            placeholder={t('Search for monitors.')}
            onSearch={this.handleSearch}
          />
        </PageHeader>
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

const StyledSearchBar = styled(SearchBar)`
  flex: 1;
`;

const NewMonitorButton = styled(Button)`
  margin-right: ${space(2)};
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

export default withRouter(withOrganization(Monitors));
