import React from 'react';
import {Location} from 'history';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PageContent} from 'app/styles/organization';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import Alert from 'app/components/alert';
import EventView from 'app/utils/discover/eventView';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import space from 'app/styles/space';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';

import {generatePerformanceEventView, DEFAULT_STATS_PERIOD} from './data';
import Table from './table';
import Charts from './charts/index';

enum FilterViews {
  ALL_TRANSACTIONS = 'ALL_TRANSACTIONS',
  KEY_TRANSACTIONS = 'KEY_TRANSACTIONS',
}

const VIEWS = Object.values(FilterViews);

type Props = {
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
};

type State = {
  eventView: EventView;
  error: string | undefined;
  currentView: FilterViews;
};

class PerformanceLanding extends React.Component<Props, State> {
  static getDerivedStateFromProps(nextProps: Props, prevState: State): State {
    return {...prevState, eventView: generatePerformanceEventView(nextProps.location)};
  }

  state: State = {
    eventView: generatePerformanceEventView(this.props.location),
    error: undefined,
    currentView: FilterViews.ALL_TRANSACTIONS,
  };

  renderError = () => {
    const {error} = this.state;

    if (!error) {
      return null;
    }

    return (
      <Alert type="error" icon="icon-circle-exclamation">
        {error}
      </Alert>
    );
  };

  setError = (error: string | undefined) => {
    this.setState({error});
  };

  generateGlobalSelection = () => {
    const {location} = this.props;
    const {eventView} = this.state;

    const globalSelection = eventView.getGlobalSelection();
    const start = globalSelection.start
      ? getUtcToLocalDateObject(globalSelection.start)
      : null;

    const end = globalSelection.end ? getUtcToLocalDateObject(globalSelection.end) : null;

    const {utc} = getParams(location.query);

    return {
      projects: globalSelection.project,
      environments: globalSelection.environment,
      datetime: {
        start,
        end,
        period: globalSelection.statsPeriod || DEFAULT_STATS_PERIOD,
        utc: utc === 'true',
      },
    };
  };

  allowClearTimeRange = (): boolean => {
    const {datetime} = this.generateGlobalSelection();
    const {start, end, period} = datetime;

    if (period === DEFAULT_STATS_PERIOD) {
      return false;
    }

    if ((start && end) || typeof period === 'string') {
      return true;
    }

    return false;
  };

  getViewLabel(currentView: FilterViews): string {
    switch (currentView) {
      case FilterViews.ALL_TRANSACTIONS:
        return t('All Transactions');
      case FilterViews.KEY_TRANSACTIONS:
        return t('My Key Transactions');
      default:
        throw Error(`Unknown view: ${currentView}`);
    }
  }

  renderDropdown() {
    const selectView = (viewKey: FilterViews) => {
      return () => {
        this.setState({
          currentView: viewKey,
        });
      };
    };

    return (
      <ButtonBar merged active={this.state.currentView}>
        {VIEWS.map(viewKey => {
          return (
            <Button
              key={viewKey}
              barId={viewKey}
              size="small"
              onClick={selectView(viewKey)}
            >
              {this.getViewLabel(viewKey)}
            </Button>
          );
        })}
      </ButtonBar>
    );
  }

  render() {
    const {organization, location, router} = this.props;
    const {eventView} = this.state;

    return (
      <SentryDocumentTitle title={t('Performance')} objSlug={organization.slug}>
        <React.Fragment>
          <GlobalSelectionHeader
            organization={organization}
            selection={this.generateGlobalSelection()}
            allowClearTimeRange={this.allowClearTimeRange()}
          />
          <PageContent>
            <LightWeightNoProjectMessage organization={organization}>
              <StyledPageHeader>
                <div>{t('Performance')}</div>
                <div>{this.renderDropdown()}</div>
              </StyledPageHeader>
              {this.renderError()}
              <Charts
                eventView={eventView}
                organization={organization}
                location={location}
                router={router}
                keyTransactions={this.state.currentView === 'KEY_TRANSACTIONS'}
              />
              <Table
                eventView={eventView}
                organization={organization}
                location={location}
                setError={this.setError}
                keyTransactions={this.state.currentView === 'KEY_TRANSACTIONS'}
              />
            </LightWeightNoProjectMessage>
          </PageContent>
        </React.Fragment>
      </SentryDocumentTitle>
    );
  }
}

export const StyledPageHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.gray4};
  height: 40px;
  margin-bottom: ${space(1)};
`;

export default withOrganization(PerformanceLanding);
