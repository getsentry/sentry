import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import {t} from 'app/locale';
import withOrganization from 'app/utils/withOrganization';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PageContent} from 'app/styles/organization';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import space from 'app/styles/space';
import AsyncComponent from 'app/components/asyncComponent';

import {DashboardListItem, DashboardState} from './types';
import {PREBUILT_DASHBOARDS} from './data';
import Controls from './controls';
import Dashboard from './dashboard';

type Props = {
  location: Location;
  organization: Organization;
};

type State = {
  dashboardState: DashboardState;
  orgDashboards: DashboardListItem[] | null;
} & AsyncComponent['state'];
class DashboardDetail extends AsyncComponent<Props, State> {
  state: State = {
    // AsyncComponent state
    loading: true,
    reloading: false,
    error: false,
    errors: [],

    // endpoint response
    orgDashboards: [],

    // local state
    dashboardState: 'default',
  };

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;

    const url = `/organizations/${organization.slug}/dashboards/`;

    return [['orgDashboards', url]];
  }

  onEdit = () => {
    this.setState({
      dashboardState: 'edit',
    });
  };

  getDashboardsList() {
    const {orgDashboards} = this.state;

    if (!Array.isArray(orgDashboards)) {
      return PREBUILT_DASHBOARDS;
    }

    return [...PREBUILT_DASHBOARDS, ...orgDashboards];
  }

  render() {
    const {organization, location} = this.props;

    if (!organization.features.includes('dashboards-v2')) {
      // Redirect to Dashboards v1
      browserHistory.replace({
        pathname: `/organizations/${organization.slug}/dashboards/`,
        query: {
          ...location.query,
        },
      });
      return null;
    }

    return (
      <SentryDocumentTitle title={t('Dashboards')} objSlug={organization.slug}>
        <GlobalSelectionHeader
          skipLoadLastUsed={organization.features.includes('global-views')}
        >
          <PageContent>
            <LightWeightNoProjectMessage organization={organization}>
              <StyledPageHeader>
                <div>{t('Dashboards')}</div>
                <Controls
                  dashboards={this.getDashboardsList()}
                  onEdit={this.onEdit}
                  dashboardState={this.state.dashboardState}
                />
              </StyledPageHeader>
              <Dashboard />
            </LightWeightNoProjectMessage>
          </PageContent>
        </GlobalSelectionHeader>
      </SentryDocumentTitle>
    );
  }
}

const StyledPageHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.textColor};
  height: 40px;
  margin-bottom: ${space(1)};
`;

export default withOrganization(DashboardDetail);
