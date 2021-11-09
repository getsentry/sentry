import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import NoProjectMessage from 'app/components/noProjectMessage';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {GlobalSelection, Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

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
      eventView: generatePerformanceEventView(
        nextProps.organization,
        nextProps.location,
        nextProps.projects,
        true
      ),
    };
  }

  state: State = {
    eventView: generatePerformanceEventView(
      this.props.organization,
      this.props.location,
      this.props.projects,
      true
    ),
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
