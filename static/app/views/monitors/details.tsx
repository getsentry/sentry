import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {Panel, PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import MonitorCheckIns from './monitorCheckIns';
import MonitorHeader from './monitorHeader';
import MonitorIssues from './monitorIssues';
import MonitorStats from './monitorStats';
import MonitorOnboarding from './onboarding';
import {Monitor} from './types';

type Props = AsyncView['props'] &
  RouteComponentProps<{monitorId: string; orgId: string}, {}> & {
    organization: Organization;
  };

type State = AsyncView['state'] & {
  monitor: Monitor | null;
};

class MonitorDetails extends AsyncView<Props, State> {
  get orgSlug() {
    return this.props.organization.slug;
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params, location} = this.props;
    return [['monitor', `/monitors/${params.monitorId}/`, {query: location.query}]];
  }

  getTitle() {
    if (this.state.monitor) {
      return `${this.state.monitor.name} - Monitors - ${this.orgSlug}`;
    }
    return `Monitors - ${this.orgSlug}`;
  }

  onUpdate = (data: Monitor) =>
    this.setState(state => ({monitor: {...state.monitor, ...data}}));

  renderBody() {
    const {monitor} = this.state;

    if (monitor === null) {
      return null;
    }

    return (
      <Fragment>
        <MonitorHeader monitor={monitor} orgId={this.orgSlug} onUpdate={this.onUpdate} />
        <Layout.Body>
          <Layout.Main fullWidth>
            {!monitor.lastCheckIn && <MonitorOnboarding monitor={monitor} />}

            <StyledPageFilterBar condensed>
              <DatePageFilter alignDropdown="left" />
            </StyledPageFilterBar>

            <MonitorStats monitor={monitor} />

            <MonitorIssues monitor={monitor} orgId={this.orgSlug} />

            <Panel>
              <PanelHeader>{t('Recent Check-ins')}</PanelHeader>

              <MonitorCheckIns monitor={monitor} />
            </Panel>
          </Layout.Main>
        </Layout.Body>
      </Fragment>
    );
  }
}

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;

export default withOrganization(MonitorDetails);
