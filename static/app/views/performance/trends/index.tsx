import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization, PageFilters, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';

import {generatePerformanceEventView} from '../data';

import TrendsContent from './content';

type Props = RouteComponentProps<{}, {}> & {
  api: Client;
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
      eventView: generatePerformanceEventView(nextProps.location, nextProps.projects, {
        isTrends: true,
      }),
    };
  }

  state: State = {
    eventView: generatePerformanceEventView(this.props.location, this.props.projects, {
      isTrends: true,
    }),
    error: undefined,
  };

  getDocumentTitle(): string {
    return [t('Trends'), t('Performance')].join(' - ');
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
    const {organization} = this.props;

    return (
      <SentryDocumentTitle title={this.getDocumentTitle()} orgSlug={organization.slug}>
        <StyledPageContent>
          <NoProjectMessage organization={organization}>
            {this.renderContent()}
          </NoProjectMessage>
        </StyledPageContent>
      </SentryDocumentTitle>
    );
  }
}

export default withOrganization(withProjects(withPageFilters(withApi(TrendsSummary))));
const StyledPageContent = styled(PageContent)`
  padding: 0;
`;
