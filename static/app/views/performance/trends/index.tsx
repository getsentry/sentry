import {Component} from 'react';
import {Location} from 'history';

import {Client} from 'sentry/api';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Organization, PageFilters, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';

import {generatePerformanceEventView} from '../data';

import TrendsContent from './content';

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
  projects: Project[];
  selection: PageFilters;
};

type State = {
  eventView: EventView;
  error?: string;
};

class TrendsSummary extends Component<Props, State> {
  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    return {
      ...prevState,
      eventView: generatePerformanceEventView(
        nextProps.location,
        nextProps.projects,
        {
          isTrends: true,
        },
        nextProps.organization
      ),
    };
  }

  state: State = {
    eventView: generatePerformanceEventView(
      this.props.location,
      this.props.projects,
      {
        isTrends: true,
      },
      this.props.organization
    ),
    error: undefined,
  };

  getDocumentTitle(): string {
    return [t('Trends'), t('Performance')].join(' — ');
  }

  setError = (error: string | undefined) => {
    this.setState({error});
  };

  renderContent() {
    const {organization, location, projects} = this.props;
    const {eventView} = this.state;
    return (
      <TrendsContent
        organization={organization}
        location={location}
        eventView={eventView}
        projects={projects}
      />
    );
  }

  render() {
    const {organization, location} = this.props;

    return (
      <SentryDocumentTitle title={this.getDocumentTitle()} orgSlug={organization.slug}>
        <Layout.Page>
          <MetricsCardinalityProvider
            sendOutcomeAnalytics
            organization={organization}
            location={location}
          >
            {this.renderContent()}
          </MetricsCardinalityProvider>
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }
}

export default withOrganization(withProjects(withPageFilters(withApi(TrendsSummary))));
