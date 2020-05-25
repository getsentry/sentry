import React from 'react';
import {Location} from 'history';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import FeatureBadge from 'app/components/featureBadge';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {PageContent} from 'app/styles/organization';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import Alert from 'app/components/alert';
import EventView from 'app/utils/discover/eventView';
import space from 'app/styles/space';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import {generatePerformanceEventView, DEFAULT_STATS_PERIOD} from './data';
import Table from './table';
import Charts from './charts/index';
import Onboarding from './onboarding';

enum FilterViews {
  ALL_TRANSACTIONS = 'ALL_TRANSACTIONS',
  KEY_TRANSACTIONS = 'KEY_TRANSACTIONS',
}

const VIEWS = Object.values(FilterViews);

type Props = {
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  projects: Project[];
  loadingProjects: boolean;
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

  renderHeaderButtons() {
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

  shouldShowOnboarding() {
    const {projects} = this.props;
    const {eventView} = this.state;

    if (projects.length === 0) {
      return false;
    }

    // Current selection is 'my projects' or 'all projects'
    if (eventView.project.length === 0 || eventView.project === [ALL_ACCESS_PROJECTS]) {
      return (
        projects.filter(p => p.firstTransactionEvent === false).length === projects.length
      );
    }

    // Any other subset of projects.
    return (
      projects.filter(
        p =>
          eventView.project.includes(parseInt(p.id, 10)) &&
          p.firstTransactionEvent === false
      ).length === eventView.project.length
    );
  }

  render() {
    const {organization, location, router, projects} = this.props;
    const {eventView} = this.state;
    const showOnboarding = this.shouldShowOnboarding();

    return (
      <SentryDocumentTitle title={t('Performance')} objSlug={organization.slug}>
        <GlobalSelectionHeader
          defaultSelection={{
            datetime: {
              start: null,
              end: null,
              utc: false,
              period: DEFAULT_STATS_PERIOD,
            },
          }}
        >
          <PageContent>
            <LightWeightNoProjectMessage organization={organization}>
              <StyledPageHeader>
                <div>
                  {t('Performance')} <FeatureBadge type="beta" />
                </div>
                {!showOnboarding && <div>{this.renderHeaderButtons()}</div>}
              </StyledPageHeader>
              {this.renderError()}
              {showOnboarding ? (
                <Onboarding />
              ) : (
                <React.Fragment>
                  <Charts
                    eventView={eventView}
                    organization={organization}
                    location={location}
                    router={router}
                    keyTransactions={this.state.currentView === 'KEY_TRANSACTIONS'}
                  />
                  <Table
                    eventView={eventView}
                    projects={projects}
                    organization={organization}
                    location={location}
                    setError={this.setError}
                    keyTransactions={this.state.currentView === 'KEY_TRANSACTIONS'}
                  />
                </React.Fragment>
              )}
            </LightWeightNoProjectMessage>
          </PageContent>
        </GlobalSelectionHeader>
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

export default withOrganization(withProjects(PerformanceLanding));
