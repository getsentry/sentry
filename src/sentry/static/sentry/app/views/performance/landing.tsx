import React from 'react';
import {Location} from 'history';
import * as ReactRouter from 'react-router';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PageContent} from 'app/styles/organization';
import NoProjectMessage from 'app/components/noProjectMessage';
import Alert from 'app/components/alert';
import EventView from 'app/views/eventsV2/eventView';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {StyledPageHeader} from 'app/views/eventsV2/landing';

import {generatePerformanceEventView, DEFAULT_STATS_PERIOD} from './data';
import Table from './table';
import Charts from './charts/index';

type Props = {
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
};

type State = {
  eventView: EventView;
  error: string | undefined;
};

class PerformanceLanding extends React.Component<Props, State> {
  static getDerivedStateFromProps(nextProps: Props, prevState: State): State {
    return {...prevState, eventView: generatePerformanceEventView(nextProps.location)};
  }

  state = {
    eventView: generatePerformanceEventView(this.props.location),
    error: undefined,
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
      : undefined;

    const end = globalSelection.end
      ? getUtcToLocalDateObject(globalSelection.end)
      : undefined;

    const {utc} = getParams(location.query);

    return {
      projects: globalSelection.project,
      environments: globalSelection.environment,
      datetime: {
        start,
        end,
        period: globalSelection.statsPeriod,
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
            <NoProjectMessage organization={organization}>
              <StyledPageHeader>{t('Performance')}</StyledPageHeader>
              {this.renderError()}
              <Charts
                eventView={eventView}
                organization={organization}
                location={location}
                router={router}
              />
              <Table
                eventView={eventView}
                organization={organization}
                location={location}
                setError={this.setError}
              />
            </NoProjectMessage>
          </PageContent>
        </React.Fragment>
      </SentryDocumentTitle>
    );
  }
}

export default withOrganization(PerformanceLanding);
