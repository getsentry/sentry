import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {GlobalSelection, Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import withApi from 'sentry/utils/withApi';
import withGlobalSelection from 'sentry/utils/withGlobalSelection';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

import {generatePerformanceEventView} from '../data';

import TrendsContent from './content';

type Props = RouteComponentProps<{}, {}> & {
  api: Client;
  selection: GlobalSelection;
  organization: Organization;
  projects: Project[];
};

type State = {
  eventView: EventView;
  error?: string;
};

class TrendsSummary extends React.Component<Props, State> {
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
    const {organization, location} = this.props;
    const {eventView} = this.state;
    return (
      <TrendsContent
        organization={organization}
        location={location}
        eventView={eventView}
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

export default withOrganization(
  withProjects(withGlobalSelection(withApi(TrendsSummary)))
);
const StyledPageContent = styled(PageContent)`
  padding: 0;
`;
